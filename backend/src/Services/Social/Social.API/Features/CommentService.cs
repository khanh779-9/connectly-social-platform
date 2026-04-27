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
/// Everything about the comments of a post: writing them, editing them, deleting them
/// and reacting to them.
/// </summary>
public class CommentService(
    SocialDbContext db,
    ICurrentUser currentUser,
    PostAccess access)
{
    private Guid ViewerId => currentUser.RequireUserId();

    private static CommentDto ToDto(Comment comment) => new(
        comment.Id,
        comment.PostId,
        comment.AuthorUserId,
        comment.ParentCommentId,
        comment.Content,
        comment.Status,
        comment.CreatedAt,
        comment.UpdatedAt,
        WasEdited: comment.UpdatedAt != comment.CreatedAt);

    /// <summary>Applies the author's "who can comment" setting (see Settings → Privacy).</summary>
    private async Task<bool> CanCommentOnPostAsync(Post post, CancellationToken ct)
    {
        var me = ViewerId;
        if (post.AuthorUserId == me) return true;

        var audience = await db.Profiles.AsNoTracking()
            .Where(p => p.UserId == post.AuthorUserId)
            .Select(p => (ProfileAudience?)p.CommentAudience)
            .SingleOrDefaultAsync(ct);
        if (audience is null or ProfileAudience.Everyone) return true;

        var low = post.AuthorUserId < me ? post.AuthorUserId : me;
        var high = post.AuthorUserId < me ? me : post.AuthorUserId;
        return await db.Friendships.AsNoTracking()
            .AnyAsync(f => f.UserLowId == low && f.UserHighId == high && f.Status == FriendshipStatus.Accepted, ct);
    }

    public async Task<CommentDto> CreateCommentAsync(Guid postId, CreateCommentRequest request, CancellationToken ct)
    {
        var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == postId, ct)
            ?? throw new KeyNotFoundException("Post not found.");
        if (post.Status != PostStatus.Published || !await access.CanViewAsync(post, ct))
            throw new UnauthorizedAccessException("You cannot comment on this post.");
        if (string.IsNullOrWhiteSpace(request.Content) || request.Content.Length > 2000)
            throw new ArgumentException("Comment content is empty or too long.");
        if (!await CanCommentOnPostAsync(post, ct))
            throw new UnauthorizedAccessException("The author only accepts comments from friends.");

        Comment? parent = null;
        if (request.ParentCommentId is not null)
        {
            parent = await db.Comments.AsNoTracking()
                .SingleOrDefaultAsync(c => c.Id == request.ParentCommentId && c.PostId == postId, ct);
            if (parent is null || parent.Status != "active")
                throw new InvalidOperationException("Parent comment is unavailable.");
        }

        var me = ViewerId;
        var comment = new Comment
        {
            PostId = postId,
            AuthorUserId = me,
            ParentCommentId = parent?.Id,
            Content = request.Content.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Comments.Add(comment);

        var mentions = await MentionIndexer.IndexCommentMentionsAsync(
            db, comment.Id, postId, comment.Content, me, ct);

        var preview = comment.Content[..Math.Min(comment.Content.Length, 200)];
        db.EnqueueEvent(EventTypes.Social.CommentCreated,
            new CommentCreatedV1(comment.Id, postId, post.AuthorUserId, me, preview), EventProducer.Name);
        await db.SaveChangesAsync(ct);

        return ToDto(comment) with { Mentions = mentions };
    }

    public async Task<CommentDto> EditCommentAsync(Guid commentId, UpdateCommentRequest request, CancellationToken ct)
    {
        var comment = await db.Comments.SingleOrDefaultAsync(c => c.Id == commentId, ct)
            ?? throw new KeyNotFoundException("Comment not found.");
        if (comment.Status != "active") throw new InvalidOperationException("Comment is unavailable.");

        var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == comment.PostId, ct);
        var canEdit = comment.AuthorUserId == ViewerId || (post is not null && post.AuthorUserId == ViewerId);
        if (!canEdit) throw new UnauthorizedAccessException("You cannot edit this comment.");
        if (string.IsNullOrWhiteSpace(request.Content) || request.Content.Length > 2000)
            throw new ArgumentException("Comment content is empty or too long.");

        var previousContent = comment.Content;
        comment.Content = request.Content.Trim();
        comment.UpdatedAt = DateTimeOffset.UtcNow;

        if (!string.Equals(previousContent, comment.Content, StringComparison.Ordinal))
        {
            db.CommentEdits.Add(new CommentEdit
            {
                CommentId = comment.Id,
                EditorUserId = ViewerId,
                PreviousContent = previousContent,
                NewContent = comment.Content,
                EditedAt = comment.UpdatedAt
            });
        }

        var mentions = await MentionIndexer.IndexCommentMentionsAsync(
            db, comment.Id, comment.PostId, comment.Content, comment.AuthorUserId, ct);
        await db.SaveChangesAsync(ct);

        return ToDto(comment) with { Mentions = mentions };
    }

    /// <summary>
    /// Soft-deletes a comment. Allowed for the author and for the owner of the post.
    /// The replies of a deleted comment are removed together with it.
    /// </summary>
    public async Task DeleteCommentAsync(Guid commentId, CancellationToken ct)
    {
        var comment = await db.Comments.Include(c => c.Post).SingleOrDefaultAsync(c => c.Id == commentId, ct)
            ?? throw new KeyNotFoundException("Comment not found.");

        var allowed = comment.AuthorUserId == ViewerId || comment.Post?.AuthorUserId == ViewerId;
        if (!allowed) throw new UnauthorizedAccessException("You cannot delete this comment.");
        if (comment.Status == "deleted") return; // idempotent

        var now = DateTimeOffset.UtcNow;
        comment.Status = "deleted";
        comment.UpdatedAt = now;

        // the replies are marked through the change tracker so they are deleted in
        // the same transaction as the comment itself
        var replies = await db.Comments.Where(c => c.ParentCommentId == commentId && c.Status == "active")
            .ToListAsync(ct);
        foreach (var reply in replies)
        {
            reply.Status = "deleted";
            reply.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task<CursorPageOf<CommentDto>> ListCommentsAsync(Guid postId, string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 50);
        var me = ViewerId;

        // a comment inherits the visibility of its post
        var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == postId, ct)
            ?? throw new KeyNotFoundException("Post not found.");
        if (!await access.CanViewAsync(post, ct))
            throw new UnauthorizedAccessException("You cannot view this post.");

        IQueryable<Comment> query = db.Comments.AsNoTracking()
            .Where(c => c.PostId == postId && c.Status == "active")
            .OrderBy(c => c.CreatedAt).ThenBy(c => c.Id);

        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(c => c.CreatedAt > time || (c.CreatedAt == time && c.Id.CompareTo(id) > 0));
        }

        var items = await query.Take(limit + 1).ToListAsync(ct);

        // two extra queries: the reaction counts and the reactions of the viewer (no N+1)
        var ids = items.Select(c => c.Id).ToList();
        var reactionCounts = await db.CommentReactions.AsNoTracking()
            .Where(r => ids.Contains(r.CommentId))
            .GroupBy(r => r.CommentId)
            .Select(g => new { CommentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CommentId, x => x.Count, ct);
        var myReactions = await db.CommentReactions.AsNoTracking()
            .Where(r => ids.Contains(r.CommentId) && r.UserId == me)
            .ToDictionaryAsync(r => r.CommentId, r => r.ReactionType, ct);

        var page = items.Take(limit);

        // the cursor points at the last row handed to the client, so the next page starts after it
        var nextCursor = items.Count > limit
            ? Cursor.Encode(items[limit - 1].CreatedAt, items[limit - 1].Id)
            : null;

        var mentionsByComment = await LoadMentionsAsync(page.Select(c => c.Id).ToList(), ct);

        var dtos = page.Select(c => ToDto(c) with
        {
            ReactionCount = reactionCounts.GetValueOrDefault(c.Id),
            ViewerReaction = myReactions.GetValueOrDefault(c.Id),
            Mentions = mentionsByComment.GetValueOrDefault(c.Id, [])
        }).ToList();

        return new CursorPageOf<CommentDto>(dtos, nextCursor);
    }

    /// <summary>Revision history of a comment; people who can read the post can read it too.</summary>
    public async Task<List<ContentEditDto>?> GetCommentEditHistoryAsync(Guid commentId, CancellationToken ct)
    {
        var comment = await db.Comments.AsNoTracking().SingleOrDefaultAsync(c => c.Id == commentId, ct);
        if (comment is null) return null;

        var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == comment.PostId, ct);
        if (post is null || !await access.CanReadAsync(post, ct)) return null;

        return await db.CommentEdits.AsNoTracking()
            .Where(e => e.CommentId == commentId)
            .OrderByDescending(e => e.EditedAt)
            .Select(e => new ContentEditDto(e.EditorUserId, e.PreviousContent, e.NewContent, e.EditedAt))
            .ToListAsync(ct);
    }

    // ---------- Reactions on a comment ----------

    public async Task SetCommentReactionAsync(Guid commentId, SetCommentReactionRequest request, CancellationToken ct)
    {
        var comment = await db.Comments.AsNoTracking()
            .SingleOrDefaultAsync(c => c.Id == commentId && c.Status == "active", ct)
            ?? throw new KeyNotFoundException("Comment not found.");

        var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == comment.PostId, ct);
        if (post is null || post.Status != PostStatus.Published || !await access.CanViewAsync(post, ct))
            throw new UnauthorizedAccessException("You cannot react to this comment.");

        var me = ViewerId;
        var type = ReactionSet.Normalize(request.ReactionType);

        var existing = await db.CommentReactions.FindAsync([commentId, me]);
        if (existing is not null)
        {
            existing.ReactionType = type;
        }
        else
        {
            db.CommentReactions.Add(new CommentReaction
            {
                CommentId = commentId,
                UserId = me,
                ReactionType = type,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task RemoveCommentReactionAsync(Guid commentId, CancellationToken ct)
    {
        var reaction = await db.CommentReactions.FindAsync([commentId, ViewerId]);
        if (reaction is null) return;

        db.CommentReactions.Remove(reaction);
        await db.SaveChangesAsync(ct);
    }

    // ---------- Mentions of a page of comments ----------

    /// <summary>The tagged users of a page of comments (one query, no N+1).</summary>
    private async Task<Dictionary<Guid, List<MentionDto>>> LoadMentionsAsync(List<Guid> commentIds, CancellationToken ct)
    {
        if (commentIds.Count == 0) return [];

        var mentionRows = await db.CommentMentions.AsNoTracking()
            .Where(m => commentIds.Contains(m.CommentId))
            .ToListAsync(ct);
        if (mentionRows.Count == 0) return [];

        var mentionedUserIds = mentionRows.Select(m => m.UserId).Distinct().ToList();
        var mentionUsers = await db.Profiles.AsNoTracking()
            .Where(p => p.Username != null && mentionedUserIds.Contains(p.UserId))
            .Select(p => new { p.UserId, p.Username })
            .ToListAsync(ct);
        var usernameByUser = mentionUsers.ToDictionary(x => x.UserId, x => x.Username!);

        return mentionRows
            .GroupBy(m => m.CommentId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(m => new MentionDto(m.UserId, usernameByUser.GetValueOrDefault(m.UserId, "")))
                    .Where(m => m.Username.Length > 0)
                    .ToList());
    }
}
