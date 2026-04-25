using System.Text.RegularExpressions;
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
/// Everything about a post itself: writing it, editing it, deleting it, reading it,
/// sharing it and bookmarking it. Comments, reactions and feeds live in their own services.
/// </summary>
public class PostService(
    SocialDbContext db,
    ICurrentUser currentUser,
    PostMapper mapper,
    PostAccess access,
    ILogger<PostService> logger)
{
    private Guid ViewerId => currentUser.RequireUserId();

    // ---------- Hashtags ----------

    private static readonly Regex HashtagPattern = new("#[\\p{L}\\p{N}_]{1,50}", RegexOptions.Compiled);

    /// <summary>Extracts normalized hashtags (#letters/digits/_) from text; max 10 per post.</summary>
    private static List<string> ExtractHashtags(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];

        return HashtagPattern.Matches(text)
            .Select(match => match.Value[1..].ToLowerInvariant())
            .Where(tag => tag.Length > 0)
            .Distinct()
            .Take(10)
            .ToList();
    }

    /// <summary>
    /// Replaces the hashtag index of a post. Only the rows that actually changed are
    /// touched, and everything goes through the change tracker — a bulk delete would
    /// commit on its own, outside the transaction of the surrounding save.
    /// </summary>
    private async Task IndexHashtagsAsync(Guid postId, string? text, CancellationToken ct)
    {
        var tags = ExtractHashtags(text);
        var existing = await db.PostHashtags.Where(h => h.PostId == postId).ToListAsync(ct);
        var wanted = tags.ToHashSet();

        foreach (var row in existing.Where(h => !wanted.Contains(h.Tag)))
            db.PostHashtags.Remove(row);

        var present = existing.Select(h => h.Tag).ToHashSet();
        var now = DateTimeOffset.UtcNow;
        foreach (var tag in tags.Where(t => !present.Contains(t)))
            db.PostHashtags.Add(new PostHashtag { PostId = postId, Tag = tag, CreatedAt = now });
    }

    // ---------- Create / Publish / Update / Delete ----------

    public async Task<PostDto> CreatePostAsync(CreatePostRequest request, CancellationToken ct)
    {
        var me = ViewerId;
        var mediaIds = request.MediaAssetIds.Distinct().ToList();

        var assets = new List<MediaAsset>();
        if (mediaIds.Count > 0)
        {
            assets = await db.MediaAssets.Where(m => mediaIds.Contains(m.Id)).ToListAsync(ct);
            if (assets.Count != mediaIds.Count)
                throw new ArgumentException("Some media assets do not exist.");
            if (assets.Any(a => a.OwnerUserId != me))
                throw new UnauthorizedAccessException("You can only attach your own media.");
            if (assets.Any(a => a.Status != "ready"))
                throw new ArgumentException("Some media uploads are not completed yet.");
        }

        var now = DateTimeOffset.UtcNow;
        var post = new Post
        {
            AuthorUserId = me,
            TextContent = request.TextContent,
            Visibility = request.Visibility,
            GroupId = request.GroupId,
            Status = request.PublishImmediately ? PostStatus.Published : PostStatus.Draft,
            PublishedAt = request.PublishImmediately ? now : null,
            CreatedAt = now,
            UpdatedAt = now
        };

        // a post in a group needs an active membership, and the group decides the audience
        if (request.GroupId is { } groupId)
        {
            var group = await db.Groups.AsNoTracking().SingleOrDefaultAsync(g => g.Id == groupId, ct)
                ?? throw new KeyNotFoundException("Group not found.");

            var isMember = await db.GroupMembers.AsNoTracking().AnyAsync(m =>
                m.GroupId == groupId && m.UserId == me && m.Status == GroupMemberStatus.Active, ct);
            if (!isMember)
                throw new UnauthorizedAccessException("Only group members can post in this group.");

            post.Visibility = group.Visibility == GroupVisibility.Private
                ? PostVisibility.Friends
                : PostVisibility.Public;
        }

        // a post on a page needs an editor or admin, and the audience is public
        if (request.PageId is { } pageId)
        {
            if (!await db.Pages.AsNoTracking().AnyAsync(p => p.Id == pageId, ct))
                throw new KeyNotFoundException("Page not found.");

            var canPublish = await db.PageAdmins.AsNoTracking().AnyAsync(a =>
                a.PageId == pageId && a.UserId == me &&
                (a.Role == PageAdminRole.Owner || a.Role == PageAdminRole.Admin || a.Role == PageAdminRole.Editor), ct);
            if (!canPublish)
                throw new UnauthorizedAccessException("Only page admins can publish on this page.");

            post.PageId = pageId;
            post.Visibility = PostVisibility.Public;
        }

        db.Posts.Add(post);
        for (var i = 0; i < assets.Count; i++)
        {
            var asset = assets[i];
            post.Media.Add(new PostMedia
            {
                PostId = post.Id,
                ObjectKey = asset.ObjectKey,
                ContentType = asset.ContentType,
                SizeBytes = asset.SizeBytes,
                SortOrder = i
            });
        }

        await IndexHashtagsAsync(post.Id, post.TextContent, ct);

        // drafts stay unindexed for mentions — the publish action indexes and notifies them once
        if (request.PublishImmediately)
            await MentionIndexer.IndexPostMentionsAsync(db, post.Id, post.TextContent, me, notify: true, ct);

        AddPoll(post.Id, request.Poll);

        if (request.PublishImmediately)
            db.EnqueueEvent(EventTypes.Social.PostPublished, NewPostPublished(post), EventProducer.Name);

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Post {PostId} created by {User} (status {Status})", post.Id, me, post.Status);

        var dto = await mapper.ToDtoAsync(post, ct);
        var enriched = await mapper.WithStatsAsync([dto], ct);
        return enriched.First();
    }

    public async Task<PostDto> PublishPostAsync(Guid postId, CancellationToken ct)
    {
        var post = await db.Posts.Include(p => p.Media).SingleOrDefaultAsync(p => p.Id == postId, ct)
            ?? throw new KeyNotFoundException("Post not found.");
        if (post.AuthorUserId != ViewerId) throw new UnauthorizedAccessException("Not your post.");
        if (post.Status != PostStatus.Draft) throw new InvalidOperationException("Only drafts can be published.");

        post.Status = PostStatus.Published;
        post.PublishedAt = DateTimeOffset.UtcNow;
        post.UpdatedAt = post.PublishedAt.Value;

        await IndexHashtagsAsync(post.Id, post.TextContent, ct);
        await MentionIndexer.IndexPostMentionsAsync(db, post.Id, post.TextContent, post.AuthorUserId, notify: true, ct);
        db.EnqueueEvent(EventTypes.Social.PostPublished, NewPostPublished(post), EventProducer.Name);
        await db.SaveChangesAsync(ct);

        var dto = await mapper.ToDtoAsync(post, ct);
        var enriched = await mapper.WithStatsAsync([dto], ct);
        return enriched.First();
    }

    public async Task<PostDto> UpdatePostAsync(Guid postId, UpdatePostRequest request, CancellationToken ct)
    {
        var post = await db.Posts.Include(p => p.Media).SingleOrDefaultAsync(p => p.Id == postId, ct)
            ?? throw new KeyNotFoundException("Post not found.");
        if (post.AuthorUserId != ViewerId) throw new UnauthorizedAccessException("Not your post.");
        if (post.Status == PostStatus.Deleted) throw new InvalidOperationException("Post deleted.");

        var previousText = post.TextContent;
        if (request.TextContent is not null) post.TextContent = request.TextContent;

        // posts of a group keep the audience of their group — visibility is not editable by hand
        if (request.Visibility is not null && post.GroupId is null) post.Visibility = request.Visibility.Value;

        post.EditedAt = DateTimeOffset.UtcNow;
        post.UpdatedAt = post.EditedAt.Value;

        // only a real text change is a revision; flipping the audience is not
        if (!string.Equals(previousText, post.TextContent, StringComparison.Ordinal))
        {
            db.PostEdits.Add(new PostEdit
            {
                PostId = post.Id,
                EditorUserId = ViewerId,
                PreviousText = previousText,
                NewText = post.TextContent,
                EditedAt = post.EditedAt.Value
            });
        }

        await IndexHashtagsAsync(post.Id, post.TextContent, ct);

        // only published posts notify their mentions (editing a draft stays silent)
        await MentionIndexer.IndexPostMentionsAsync(db, post.Id, post.TextContent, post.AuthorUserId,
            notify: post.Status == PostStatus.Published, ct);
        await db.SaveChangesAsync(ct);

        var dto = await mapper.ToDtoAsync(post, ct);
        var enriched = await mapper.WithStatsAsync([dto], ct);
        return enriched.First();
    }

    public async Task DeletePostAsync(Guid postId, CancellationToken ct)
    {
        var post = await db.Posts.Include(p => p.Media).SingleOrDefaultAsync(p => p.Id == postId, ct)
            ?? throw new KeyNotFoundException("Post not found.");
        if (post.AuthorUserId != ViewerId) throw new UnauthorizedAccessException("Not your post.");

        post.Status = PostStatus.Deleted;
        post.DeletedAt = DateTimeOffset.UtcNow;
        db.EnqueueEvent(EventTypes.Social.PostDeleted, new PostDeletedV1(post.Id, post.AuthorUserId), EventProducer.Name);
        await db.SaveChangesAsync(ct);

        // The media files are removed later by the Hangfire reconciliation job.
        // Removing them here would happen outside the Social DB transaction.
    }

    // ---------- Read ----------

    public async Task<PostDto?> GetPostAsync(Guid postId, CancellationToken ct)
    {
        var post = await db.Posts.Include(p => p.Media).AsNoTracking().SingleOrDefaultAsync(p => p.Id == postId, ct);
        if (post is null) return null; // hide existence

        if (!await access.CanReadAsync(post, ct)) return null;

        var dto = await mapper.ToDtoAsync(post, ct);
        var enriched = await mapper.WithStatsAsync([dto], ct);
        return enriched.FirstOrDefault();
    }

    /// <summary>Revision history of a post. Null when the viewer may not read the post.</summary>
    public async Task<List<ContentEditDto>?> GetPostEditHistoryAsync(Guid postId, CancellationToken ct)
    {
        if (await GetPostAsync(postId, ct) is null) return null;

        return await db.PostEdits.AsNoTracking()
            .Where(e => e.PostId == postId)
            .OrderByDescending(e => e.EditedAt)
            .Select(e => new ContentEditDto(e.EditorUserId, e.PreviousText, e.NewText, e.EditedAt))
            .ToListAsync(ct);
    }

    // ---------- Shares ----------

    /// <summary>Records a share of a visible post and notifies the author.</summary>
    public async Task SharePostAsync(Guid postId, CancellationToken ct)
    {
        var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == postId, ct)
            ?? throw new KeyNotFoundException("Post not found.");
        if (post.Status != PostStatus.Published || !await access.CanViewAsync(post, ct))
            throw new UnauthorizedAccessException("You cannot share this post.");

        var me = ViewerId;
        db.Shares.Add(new PostShare { PostId = postId, UserId = me, CreatedAt = DateTimeOffset.UtcNow });
        db.EnqueueEvent(EventTypes.Social.PostShared, new PostSharedV1(postId, post.AuthorUserId, me), EventProducer.Name);
        await db.SaveChangesAsync(ct);
    }

    // ---------- Bookmarks ----------

    public async Task SaveBookmarkAsync(Guid postId, CancellationToken ct)
    {
        var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == postId, ct)
            ?? throw new KeyNotFoundException("Post not found.");
        if (post.Status == PostStatus.Deleted) throw new InvalidOperationException("Post deleted.");
        if (!await access.CanViewAsync(post, ct)) throw new UnauthorizedAccessException("You cannot save this post.");

        var me = ViewerId;
        if (await db.Bookmarks.FindAsync([postId, me]) is not null) return; // idempotent

        db.Bookmarks.Add(new PostBookmark { PostId = postId, UserId = me, CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(ct);
    }

    public async Task RemoveBookmarkAsync(Guid postId, CancellationToken ct)
    {
        var bookmark = await db.Bookmarks.FindAsync([postId, ViewerId]);
        if (bookmark is null) return;

        db.Bookmarks.Remove(bookmark);
        await db.SaveChangesAsync(ct);
    }

    public async Task<CursorPageOf<PostDto>> ListBookmarksAsync(string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);
        var me = ViewerId;

        var query = db.Bookmarks.AsNoTracking()
            .Where(b => b.UserId == me)
            .OrderByDescending(b => b.CreatedAt).ThenByDescending(b => b.PostId);

        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(b => b.CreatedAt < time || (b.CreatedAt == time && b.PostId.CompareTo(id) < 0))
                .OrderByDescending(b => b.CreatedAt).ThenByDescending(b => b.PostId);
        }

        var rows = await query.Take(limit + 1).ToListAsync(ct);
        var postIds = rows.Select(r => r.PostId).ToList();
        var posts = await db.Posts.AsNoTracking().Include(p => p.Media)
            .Where(p => postIds.Contains(p.Id) && p.Status == PostStatus.Published)
            .ToListAsync(ct);
        var byId = posts.ToDictionary(p => p.Id);

        var raw = new List<PostDto>();
        foreach (var row in rows.Take(limit))
        {
            if (!byId.TryGetValue(row.PostId, out var post)) continue;
            if (!await access.CanViewAsync(post, ct)) continue;
            raw.Add(await mapper.ToDtoAsync(post, ct));
        }

        var enriched = await mapper.WithStatsAsync(raw, ct);
        var last = rows.Count > limit ? rows[limit - 1] : rows.LastOrDefault();
        var next = last is null ? null : Cursor.Encode(last.CreatedAt, last.PostId);
        return new CursorPageOf<PostDto>(enriched, next);
    }

    // ---------- Polls on creation ----------

    /// <summary>Attaches a poll to a post (2–6 options, unique trimmed labels).</summary>
    private void AddPoll(Guid postId, PollInput? input)
    {
        if (input is null) return;

        var question = input.Question.Trim();
        var options = input.Options
            .Select(o => o.Trim())
            .Where(o => o.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(6)
            .ToList();

        // a malformed poll is ignored, the post itself is still created
        if (question.Length == 0 || options.Count < 2) return;

        db.Polls.Add(new Poll
        {
            PostId = postId,
            Question = question,
            AllowMultiple = input.AllowMultiple,
            CreatedAt = DateTimeOffset.UtcNow
        });

        for (var i = 0; i < options.Count; i++)
            db.PollOptions.Add(new PollOption { PostId = postId, Text = options[i], SortOrder = i });
    }

    /// <summary>The event carries a short preview of the post, not the whole text.</summary>
    private static PostPublishedV1 NewPostPublished(Post post)
    {
        var preview = post.TextContent?[..Math.Min(post.TextContent?.Length ?? 0, 200)];
        return new PostPublishedV1(post.Id, post.AuthorUserId, post.Visibility.ToString(), preview);
    }
}
