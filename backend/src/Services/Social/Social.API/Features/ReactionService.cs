using BuildingBlocks.Auth;
using BuildingBlocks.Messaging;
using BuildingBlocks.Pagination;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Social;
using Microsoft.EntityFrameworkCore;
using Social.Domain;
using Social.Persistence;

namespace Social.Features;

/// <summary>
/// The emoji reactions on a post: setting one, removing it and listing who reacted.
/// </summary>
public class ReactionService(
    SocialDbContext db,
    ICurrentUser currentUser,
    PostAccess access)
{
    private Guid ViewerId => currentUser.RequireUserId();

    public async Task SetReactionAsync(Guid postId, SetReactionRequest request, CancellationToken ct)
    {
        var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == postId, ct)
            ?? throw new KeyNotFoundException("Post not found.");
        if (post.Status != PostStatus.Published || !await access.CanViewAsync(post, ct))
            throw new UnauthorizedAccessException("You cannot react to this post.");

        var me = ViewerId;
        var type = ReactionSet.Normalize(request.ReactionType);

        var existing = await db.PostReactions.FindAsync([postId, me]);
        if (existing is not null)
        {
            // the same reaction twice is not a change, so no event is sent
            if (existing.ReactionType == type) return;
            existing.ReactionType = type;
        }
        else
        {
            db.PostReactions.Add(new PostReaction
            {
                PostId = postId,
                UserId = me,
                ReactionType = type,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        db.EnqueueEvent(EventTypes.Social.ReactionChanged,
            new ReactionChangedV1(postId, post.AuthorUserId, me, type, Removed: false), EventProducer.Name);
        await db.SaveChangesAsync(ct);
    }

    public async Task RemoveReactionAsync(Guid postId, CancellationToken ct)
    {
        var me = ViewerId;
        var reaction = await db.PostReactions.FindAsync([postId, me]);
        if (reaction is null) return;

        var postOwner = await db.Posts.AsNoTracking()
            .Where(p => p.Id == postId)
            .Select(p => p.AuthorUserId)
            .FirstOrDefaultAsync(ct);

        db.PostReactions.Remove(reaction);
        db.EnqueueEvent(EventTypes.Social.ReactionChanged,
            new ReactionChangedV1(postId, postOwner, me, reaction.ReactionType, Removed: true), EventProducer.Name);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Lists who reacted to a post, optionally filtered by reaction type (cursor pagination).</summary>
    public async Task<CursorPageOf<ReactionActorDto>> ListReactorsAsync(
        Guid postId, string? type, string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 50);

        var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == postId, ct)
            ?? throw new KeyNotFoundException("Post not found.");
        if (!await access.CanViewAsync(post, ct))
            throw new UnauthorizedAccessException("You cannot view reactions on this post.");

        var reactionType = string.IsNullOrWhiteSpace(type) ? null : ReactionSet.Normalize(type);

        var query = db.PostReactions.AsNoTracking()
            .Where(r => r.PostId == postId)
            .OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.UserId);
        if (reactionType is not null)
        {
            query = query.Where(r => r.ReactionType == reactionType)
                .OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.UserId);
        }

        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(r => r.CreatedAt < time || (r.CreatedAt == time && r.UserId.CompareTo(id) < 0))
                .OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.UserId);
        }

        var rows = await query.Take(limit + 1).ToListAsync(ct);
        var page = rows.Take(limit);
        var nextCursor = rows.Count > limit
            ? Cursor.Encode(rows[limit - 1].CreatedAt, rows[limit - 1].UserId)
            : null;

        var actors = page.Select(r => new ReactionActorDto(r.UserId, r.ReactionType, r.CreatedAt)).ToList();
        return new CursorPageOf<ReactionActorDto>(actors, nextCursor);
    }
}
