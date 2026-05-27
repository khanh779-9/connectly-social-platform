using BuildingBlocks.Auth;
using Chat.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Chat.Features;

/// <summary>
/// The checks that decide whether the viewer may take part in a conversation:
/// being a member of it and not being blocked by one of the other members.
/// </summary>
public class ChatGuard(
    ChatDbContext db,
    ICurrentUser currentUser)
{
    private Guid Me => currentUser.RequireUserId();

    /// <summary>
    /// True when the viewer has blocked, or is blocked by, any of the given users.
    /// The projection is fed by social.user-blocked.v1, so Chat never reads Social's database.
    /// </summary>
    public async Task<bool> IsBlockedWithAnyAsync(List<Guid> otherUserIds, CancellationToken ct)
    {
        if (otherUserIds.Count == 0) return false;

        return await db.BlockedPairs.AsNoTracking().AnyAsync(
            p => (p.BlockerId == Me && otherUserIds.Contains(p.BlockedUserId))
                 || (p.BlockedUserId == Me && otherUserIds.Contains(p.BlockerId)), ct);
    }

    /// <summary>Throws when the viewer is not a member of the conversation.</summary>
    public async Task EnsureMemberAsync(Guid conversationId, CancellationToken ct)
    {
        var isMember = await db.ConversationMembers.AsNoTracking()
            .AnyAsync(m => m.ConversationId == conversationId && m.UserId == Me, ct);
        if (!isMember) throw new UnauthorizedAccessException("Not a member of this conversation.");
    }
}
