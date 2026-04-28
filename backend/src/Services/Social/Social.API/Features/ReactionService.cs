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

