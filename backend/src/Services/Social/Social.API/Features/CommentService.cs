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

