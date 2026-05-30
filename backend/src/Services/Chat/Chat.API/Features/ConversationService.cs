using BuildingBlocks.Auth;
using BuildingBlocks.Messaging;
using Chat.Domain;
using Chat.Persistence;
using Chat.Realtime;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Chat;
using Microsoft.EntityFrameworkCore;

namespace Chat.Features;

/// <summary>
/// The conversations of the viewer: creating one, listing them and reading one.
/// </summary>
public class ConversationService(
    ChatDbContext db,
    ICurrentUser currentUser,
    PresenceService presence,
    ChatSettingsService chatSettings,
    SocialRelationshipClient relationships,
    ChatGuard guard,
    ILogger<ConversationService> logger)
{
    public const string Producer = "connectly-chat";

    private const string DmType = "dm";
    private const string GroupType = "group";

    private Guid Me => currentUser.RequireUserId();

    /// <summary>
    /// Normalizes the conversation type to one of the two values the service understands.
    /// The type drives the DM-only security checks (block, message privacy, deduplication),
    /// so an unknown value must be rejected instead of silently taking the non-DM branch.
    /// </summary>
    private static string NormalizeConversationType(string? raw)
    {
        var type = (raw ?? string.Empty).Trim().ToLowerInvariant();
        if (type is not (DmType or GroupType))
            throw new ArgumentException("Conversation type must be 'dm' or 'group'.");
        return type;
    }

    public async Task<ConversationDto> CreateConversationAsync(CreateConversationRequest request, CancellationToken ct)
    {
        var type = NormalizeConversationType(request.Type);
        var memberUserIds = request.MemberUserIds.Distinct().ToList();
        if (!memberUserIds.Contains(Me)) memberUserIds.Add(Me);

        if (type == DmType)
        {
            if (memberUserIds.Count != 2) throw new ArgumentException("DM requires exactly two participants.");
            var otherUserId = memberUserIds.First(x => x != Me);

            if (await guard.IsBlockedWithAnyAsync([otherUserId], ct))
                throw new InvalidOperationException("You cannot start a chat with this user.");

            await EnsureCanMessageAsync(otherUserId, ct);

            // reuse the existing DM if there is one
            var existing = await FindDmAsync(memberUserIds, ct);
            if (existing is not null) return await ToDtoAsync(existing, ct);
        }
        else
        {
            // a blocked pair must never end up in the same conversation
            var others = memberUserIds.Where(id => id != Me).ToList();
            if (await guard.IsBlockedWithAnyAsync(others, ct))
                throw new InvalidOperationException("You cannot add this user to a conversation.");
        }

        var conversation = new Conversation
        {
            Type = type,
            Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim(),
            CreatedByUserId = Me,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Conversations.Add(conversation);

        foreach (var member in memberUserIds)
        {
            var role = member == Me && type == GroupType ? "admin" : "member";
            db.ConversationMembers.Add(new ConversationMember
            {
                ConversationId = conversation.Id,
                UserId = member,
                JoinedAt = DateTimeOffset.UtcNow,
                Role = role
            });
        }

        db.EnqueueEvent(EventTypes.Chat.ConversationCreated,
            new ConversationCreatedV1(conversation.Id, type == GroupType, memberUserIds), Producer);
        await db.SaveChangesAsync(ct);

        return await ToDtoAsync(conversation, ct);
    }

    /// <summary>
    /// Applies the recipient's "who can message me" setting before a new DM is created.
    /// The check fails closed: an unreachable Social service is treated as "not a friend",
    /// so a "friends only" recipient is never reached by a stranger.
    /// </summary>
    private async Task EnsureCanMessageAsync(Guid recipientUserId, CancellationToken ct)
    {
        var privacy = await chatSettings.MessagePrivacyOfAsync(recipientUserId, ct);
        if (privacy == ChatSettingsService.Nobody)
            throw new InvalidOperationException("This user isn't accepting new messages.");
        if (privacy != ChatSettingsService.Friends) return;

        var isFriend = await relationships.IsFriendAsync(recipientUserId, ct);
        if (isFriend != true)
            throw new InvalidOperationException("This user only accepts messages from friends.");
    }

