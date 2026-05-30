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

    /// <summary>Finds the DM between the given participants, if it already exists.</summary>
    private async Task<Conversation?> FindDmAsync(List<Guid> participants, CancellationToken ct)
    {
        return await db.Conversations
            .Where(c => c.Type == "dm" && c.Members.Count == 2)
            .Join(db.ConversationMembers, c => c.Id, m => m.ConversationId, (c, m) => new { Conversation = c, Member = m })
            .Where(x => participants.Contains(x.Member.UserId))
            .GroupBy(x => x.Conversation.Id)
            .Select(g => new { ConversationId = g.Key, Count = g.Count() })
            .Where(x => x.Count == participants.Count)
            .Select(x => x.ConversationId)
            .Join(db.Conversations, id => id, c => c.Id, (id, conv) => conv)
            .FirstOrDefaultAsync(ct);
    }

    // ---------- read ----------

    public async Task<List<ConversationDto>> GetConversationsAsync(CancellationToken ct)
    {
        var conversations = await db.Conversations
            .Include(c => c.Members)
            .Where(c => c.Members.Any(m => m.UserId == Me))
            .OrderByDescending(c => c.UpdatedAt)
            .ToListAsync(ct);

        var ids = conversations.Select(c => c.Id).ToList();
        var (lastByConversation, unreadByConversation) = await LoadConversationStatsAsync(ids, ct);

        var result = new List<ConversationDto>();
        foreach (var conversation in conversations)
        {
            var dto = await ToDtoAsync(conversation, ct);
            var last = lastByConversation.GetValueOrDefault(conversation.Id);

            dto = dto with
            {
                LastMessageAt = last?.SentAt,
                LastMessagePreview = last is null ? null : Preview(last),
                LastMessageSenderUserId = last?.SenderUserId,
                UnreadCount = unreadByConversation.GetValueOrDefault(conversation.Id)
            };
            result.Add(dto);
        }
        return result;
    }

    public async Task<ConversationDto> GetConversationAsync(Guid conversationId, CancellationToken ct)
    {
        var conversation = await db.Conversations.Include(c => c.Members)
            .SingleOrDefaultAsync(c => c.Id == conversationId, ct)
            ?? throw new KeyNotFoundException("Conversation not found.");
        if (conversation.Members.All(m => m.UserId != Me))
            throw new UnauthorizedAccessException("Not a member of this conversation.");

        var (lastByConversation, unreadByConversation) = await LoadConversationStatsAsync([conversationId], ct);
        var last = lastByConversation.GetValueOrDefault(conversationId);

        return (await ToDtoAsync(conversation, ct)) with
        {
            LastMessageAt = last?.SentAt,
            LastMessagePreview = last is null ? null : Preview(last),
            LastMessageSenderUserId = last?.SenderUserId,
            UnreadCount = unreadByConversation.GetValueOrDefault(conversationId)
        };
    }

    /// <summary>Loads the newest message and the unread counter for the given conversations (2 queries).</summary>
    private async Task<(Dictionary<Guid, Message> Last, Dictionary<Guid, int> Unread)> LoadConversationStatsAsync(
        List<Guid> conversationIds, CancellationToken ct)
    {
        if (conversationIds.Count == 0) return (new Dictionary<Guid, Message>(), new Dictionary<Guid, int>());

        var messages = await db.Messages.AsNoTracking()
            .Where(m => conversationIds.Contains(m.ConversationId) && m.Status == "sent")
            .OrderByDescending(m => m.SentAt).ThenByDescending(m => m.Id)
            .ToListAsync(ct);
        var last = messages
            .GroupBy(m => m.ConversationId)
            .ToDictionary(g => g.Key, g => g.First());

        var myMarkers = await db.ConversationMembers.AsNoTracking()
            .Where(m => m.UserId == Me && conversationIds.Contains(m.ConversationId))
            .Select(m => new { m.ConversationId, m.LastReadAt })
            .ToListAsync(ct);
        var markerByConversation = myMarkers.ToDictionary(m => m.ConversationId, m => m.LastReadAt);

        var unread = new Dictionary<Guid, int>();
        foreach (var group in messages.Where(m => m.SenderUserId != Me).GroupBy(m => m.ConversationId))
        {
            var marker = markerByConversation.GetValueOrDefault(group.Key);
            var count = marker is null
                ? group.Count()
                : group.Count(m => m.SentAt > marker.Value);
            if (count > 0) unread[group.Key] = count;
        }
        return (last, unread);
    }

    /// <summary>Short preview of the last message of a conversation.</summary>
    private static string Preview(Message message)
    {
        if (!string.IsNullOrWhiteSpace(message.Body))
            return message.Body.Length > 120 ? message.Body[..120] + "…" : message.Body;
        return message.Attachments.Count > 0 ? "Sent an attachment" : "Sent a message";
    }

    private async Task<ConversationDto> ToDtoAsync(Conversation conversation, CancellationToken ct)
    {
        // Presence is best-effort: when Redis is unavailable the chat API must still serve conversations.
        var online = new Dictionary<Guid, bool>();
        try
        {
            online = await presence.AreOnlineAsync(conversation.Members.Select(m => m.UserId), ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Presence lookup failed for conversation {ConversationId}; falling back to offline.", conversation.Id);
        }

        var members = conversation.Members
            .Select(m => new MemberDto(m.UserId, m.Role, m.LastReadAt, online.GetValueOrDefault(m.UserId)))
            .ToList();

        return new ConversationDto(
            conversation.Id,
            conversation.Type,
            conversation.Title,
            conversation.CreatedAt,
            conversation.UpdatedAt,
            members);
    }
}
