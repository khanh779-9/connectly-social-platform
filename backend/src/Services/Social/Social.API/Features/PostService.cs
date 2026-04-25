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

