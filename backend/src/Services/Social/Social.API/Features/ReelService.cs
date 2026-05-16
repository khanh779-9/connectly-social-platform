using BuildingBlocks.Auth;
using BuildingBlocks.Messaging;
using BuildingBlocks.Pagination;
using BuildingBlocks.Storage;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Social;
using Social.Domain;
using Social.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Social.Features;

public sealed record CreateReelRequest(Guid MediaAssetId, string? Caption, PostVisibility Visibility = PostVisibility.Public);

/// <summary>Which feed the viewer asked for.</summary>
public enum ReelFeedTab
{
    /// <summary>Everything the viewer is allowed to see.</summary>
    ForYou = 0,
    /// <summary>Only creators the viewer follows (plus their own reels).</summary>
    Following = 1
}

public sealed record ReelDto(
    Guid Id,
    Guid AuthorUserId,
    string? Caption,
    string Visibility,
    DateTimeOffset CreatedAt,
    string Url,
    string ContentType,
    int ReactionCount = 0,
    int CommentCount = 0,
    int ShareCount = 0,
    string? ViewerReaction = null,
    bool ViewerBookmarked = false,
    int ViewCount = 0,
    List<MentionDto>? Mentions = null);

public sealed record RecordReelViewRequest(int WatchedMs);

/// <summary>
/// Vertical short-form video (Reels). A reel is a post flagged as
/// <c>is_reel</c>, so reactions, comments, shares, bookmarks and mentions
/// are reused from the regular content model. Views and watch time are kept
/// in their own table because the blueprint treats them as separate signals.
/// </summary>
public class ReelService(
    SocialDbContext db,
    ICurrentUser currentUser,
    IFileStorage storage,
    ILogger<ReelService> logger)
{
    /// <summary>Producer identity stamped into event envelopes; single source of truth is EventProducer.</summary>
    public const string Producer = EventProducer.Name;

    /// <summary>A view only counts once the video played for at least this long.</summary>
    private const int QualifiedViewMs = 1000;

    private Guid ViewerId => currentUser.RequireUserId();

    // ---------- Create ----------
    public async Task<ReelDto> CreateReelAsync(CreateReelRequest request, CancellationToken ct)
    {
        var me = ViewerId;
        var asset = await db.MediaAssets.AsNoTracking()
            .SingleOrDefaultAsync(m => m.Id == request.MediaAssetId, ct)
            ?? throw new KeyNotFoundException("Media asset not found.");
        if (asset.OwnerUserId != me) throw new UnauthorizedAccessException("You can only publish your own media.");
        if (asset.Status != "ready") throw new ArgumentException("The upload is not completed yet.");
        if (!asset.ContentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("A reel needs a video file.");

        var now = DateTimeOffset.UtcNow;
        var post = new Post
        {
            AuthorUserId = me,
            TextContent = request.Caption?.Trim(),
            Visibility = request.Visibility,
            Status = PostStatus.Published,
            IsReel = true,
            CreatedAt = now,
            UpdatedAt = now,
            PublishedAt = now
        };
        post.Media.Add(new PostMedia
        {
            PostId = post.Id,
            ObjectKey = asset.ObjectKey,
            ContentType = asset.ContentType,
            SizeBytes = asset.SizeBytes,
            SortOrder = 0
        });
        db.Posts.Add(post);
        await db.SaveChangesAsync(ct);

        // mentions work exactly like on a regular post
        await MentionIndexer.IndexPostMentionsAsync(db, post.Id, post.TextContent, me, notify: true, ct);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Reel {PostId} published by {User}", post.Id, me);
        var dto = await ToDtoAsync(post, ct);
        return (await WithStatsAsync([dto], ct)).First();
    }

    // ---------- Read ----------
    public async Task<ReelDto?> GetReelAsync(Guid reelId, CancellationToken ct)
    {
        var post = await db.Posts.Include(p => p.Media).AsNoTracking()
            .SingleOrDefaultAsync(p => p.Id == reelId && p.IsReel, ct);
        if (post is null || post.Status != PostStatus.Published) return null;
        if (!await CanViewAsync(post, ct)) return null;

        var dto = await ToDtoAsync(post, ct);
        return (await WithStatsAsync([dto], ct)).FirstOrDefault();
    }

    /// <summary>
    /// Reel feed. "For You" returns everything visible to the viewer, newest
    /// first; "Following" narrows it down to creators the viewer follows.
    /// </summary>
    public async Task<CursorPageOf<ReelDto>> GetReelFeedAsync(
        ReelFeedTab tab, string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);
        var me = ViewerId;

        var blockedByMe = await db.Blocks.AsNoTracking().Where(b => b.BlockerId == me).Select(b => b.BlockedUserId).ToListAsync(ct);
        var blockedMe = await db.Blocks.AsNoTracking().Where(b => b.BlockedUserId == me).Select(b => b.BlockerId).ToListAsync(ct);
        var blockedIds = blockedByMe.Concat(blockedMe).Distinct().ToList();

        IQueryable<Post> query = db.Posts.AsNoTracking()
            .Include(p => p.Media)
            .Where(p => p.IsReel && p.Status == PostStatus.Published && p.GroupId == null && p.PageId == null)
            .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);

        if (tab == ReelFeedTab.Following)
        {
            var followeeIds = await db.Follows.AsNoTracking()
                .Where(f => f.FollowerId == me)
                .Select(f => f.FolloweeId)
                .ToListAsync(ct);
            var friendIds = await db.Friendships.AsNoTracking()
                .Where(f => f.Status == FriendshipStatus.Accepted && (f.UserLowId == me || f.UserHighId == me))
                .Select(f => f.UserLowId == me ? f.UserHighId : f.UserLowId)
                .ToListAsync(ct);
            var allowed = followeeIds.Concat(friendIds).Append(me).Distinct().ToList();
            query = query.Where(p => allowed.Contains(p.AuthorUserId));
        }

        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(p => p.PublishedAt < time || (p.PublishedAt == time && p.Id.CompareTo(id) < 0))
                .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);
        }

        var candidates = await query.Take(limit * 2).ToListAsync(ct);

        var visible = new List<Post>();
        foreach (var post in candidates)
        {
            if (blockedIds.Contains(post.AuthorUserId)) continue;
            if (!await CanViewAsync(post, ct)) continue;
            visible.Add(post);
            if (visible.Count >= limit) break;
        }

        var raw = new List<ReelDto>();
        foreach (var post in visible) raw.Add(await ToDtoAsync(post, ct));

        var last = visible.LastOrDefault();
        var next = last is null ? null : Cursor.Encode(last.PublishedAt ?? last.CreatedAt, last.Id);
        return new CursorPageOf<ReelDto>(await WithStatsAsync(raw, ct), next);
    }

    /// <summary>Reels published by one creator (profile tab "Reels").</summary>
    public async Task<CursorPageOf<ReelDto>> GetProfileReelsAsync(
        Guid profileUserId, string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);
        IQueryable<Post> query = db.Posts.AsNoTracking()
            .Include(p => p.Media)
            .Where(p => p.IsReel && p.AuthorUserId == profileUserId
                        && p.Status == PostStatus.Published && p.Visibility != PostVisibility.OnlyMe)
            .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);

        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(p => p.PublishedAt < time || (p.PublishedAt == time && p.Id.CompareTo(id) < 0))
                .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);
        }

        var candidates = await query.Take(limit * 2).ToListAsync(ct);
        // a reel keeps the visibility of its post: friends-only reels are not public
        var visible = new List<Post>();
        foreach (var post in candidates)
        {
            if (!await CanViewAsync(post, ct)) continue;
            visible.Add(post);
            if (visible.Count >= limit) break;
        }

        var raw = new List<ReelDto>();
        foreach (var post in visible) raw.Add(await ToDtoAsync(post, ct));
        var last = visible.LastOrDefault();
        var next = last is null ? null : Cursor.Encode(last.PublishedAt ?? last.CreatedAt, last.Id);
        return new CursorPageOf<ReelDto>(await WithStatsAsync(raw, ct), next);
    }

