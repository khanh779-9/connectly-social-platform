using BuildingBlocks.Auth;
using BuildingBlocks.Pagination;
using Microsoft.EntityFrameworkCore;
using Social.Domain;
using Social.Persistence;

namespace Social.Features;

/// <summary>
/// The lists of posts: the feed of the viewer, the posts of a profile, a group or a page,
/// the feed of a hashtag and the results of the search.
/// </summary>
public class FeedService(
    SocialDbContext db,
    ICurrentUser currentUser,
    PostMapper mapper,
    PostAccess access)
{
    private Guid ViewerId => currentUser.RequireUserId();

    /// <summary>The feed of the viewer: own posts, friends, followed people and own groups.</summary>
    public async Task<CursorPageOf<FeedItemDto>> GetFeedAsync(string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);
        var me = ViewerId;

        var friendIds = await db.Friendships.AsNoTracking()
            .Where(f => f.Status == FriendshipStatus.Accepted && (f.UserLowId == me || f.UserHighId == me))
            .Select(f => f.UserLowId == me ? f.UserHighId : f.UserLowId).ToListAsync(ct);
        var followeeIds = await db.Follows.AsNoTracking()
            .Where(f => f.FollowerId == me).Select(f => f.FolloweeId).ToListAsync(ct);
        var blockedByMe = await db.Blocks.AsNoTracking()
            .Where(b => b.BlockerId == me).Select(b => b.BlockedUserId).ToListAsync(ct);
        var blockedMe = await db.Blocks.AsNoTracking()
            .Where(b => b.BlockedUserId == me).Select(b => b.BlockerId).ToListAsync(ct);
        var blockedIds = blockedByMe.Concat(blockedMe).Distinct().ToList();

        var authorIds = friendIds.Concat(followeeIds).Append(me).Distinct()
            .Where(id => !blockedIds.Contains(id)).ToList();

        // posts published inside groups the viewer belongs to also belong to the feed
        var myGroupIds = await db.GroupMembers.AsNoTracking()
            .Where(m => m.UserId == me && m.Status == GroupMemberStatus.Active)
            .Select(m => m.GroupId).ToListAsync(ct);

        var query = db.Posts.AsNoTracking().Include(p => p.Media)
            .Where(p => p.Status == PostStatus.Published && p.PageId == null &&
                        (authorIds.Contains(p.AuthorUserId) ||
                         (p.GroupId != null && myGroupIds.Contains(p.GroupId.Value))))
            .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);

        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(p => p.PublishedAt < time || (p.PublishedAt == time && p.Id.CompareTo(id) < 0))
                .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);
        }

        var candidates = await query.Take(limit * 2).ToListAsync(ct);

        // the privacy of every post is checked in code (fan-out on read)
        var visible = await FilterVisibleAsync(candidates, limit, ct);

        var rawDtos = new List<PostDto>();
        var sources = new Dictionary<Guid, string>();
        foreach (var post in visible)
        {
            var source = "following";
            if (post.GroupId != null) source = "group";
            else if (post.AuthorUserId == me) source = "self";
            else if (friendIds.Contains(post.AuthorUserId)) source = "friends";

            sources[post.Id] = source;
            rawDtos.Add(await mapper.ToDtoAsync(post, ct));
        }

        var last = visible.LastOrDefault();
        var next = last is null ? null : Cursor.Encode(last.PublishedAt ?? last.CreatedAt, last.Id);
        var enriched = await mapper.WithStatsAsync(rawDtos, ct);
        var feedDtos = enriched.Select(p => new FeedItemDto(p, sources.GetValueOrDefault(p.Id, "friends"))).ToList();

        return new CursorPageOf<FeedItemDto>(feedDtos, next);
    }

    /// <summary>The posts of one profile, without the ones only the owner may see.</summary>
    public async Task<CursorPageOf<PostDto>> GetProfilePostsAsync(
        Guid profileUserId, string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);

        IQueryable<Post> query = db.Posts.AsNoTracking().Include(p => p.Media)
            .Where(p => p.AuthorUserId == profileUserId && p.Status == PostStatus.Published
                        && p.Visibility != PostVisibility.OnlyMe && p.PageId == null && !p.IsReel)
            .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);

        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(p => p.PublishedAt < time || (p.PublishedAt == time && p.Id.CompareTo(id) < 0));
        }

        // over-fetch, then apply the per-viewer privacy policy to every candidate
        var candidates = await query.Take(limit * 2).ToListAsync(ct);
        var visible = await FilterVisibleAsync(candidates, limit, ct);

        var raw = new List<PostDto>();
        foreach (var post in visible) raw.Add(await mapper.ToDtoAsync(post, ct));

        var result = await mapper.WithStatsAsync(raw, ct);
        var last = visible.LastOrDefault();
        var next = last is null ? null : Cursor.Encode(last.PublishedAt ?? last.CreatedAt, last.Id);
        return new CursorPageOf<PostDto>(result, next);
    }

    /// <summary>Posts published inside a group. Private groups require an active membership.</summary>
    public async Task<CursorPageOf<PostDto>> GetGroupPostsAsync(
        Guid groupId, string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);

        var group = await db.Groups.AsNoTracking().SingleOrDefaultAsync(g => g.Id == groupId, ct)
            ?? throw new KeyNotFoundException("Group not found.");
        if (group.Visibility == GroupVisibility.Private)
        {
            var isMember = await db.GroupMembers.AsNoTracking().AnyAsync(m =>
                m.GroupId == groupId && m.UserId == ViewerId && m.Status == GroupMemberStatus.Active, ct);
            if (!isMember) throw new UnauthorizedAccessException("Only members can view this group feed.");
        }

        var query = db.Posts.AsNoTracking().Include(p => p.Media)
            .Where(p => p.GroupId == groupId && p.Status == PostStatus.Published)
            .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);

        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(p => p.PublishedAt < time || (p.PublishedAt == time && p.Id.CompareTo(id) < 0))
                .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);
        }

        var rows = await query.Take(limit + 1).ToListAsync(ct);
        var page = rows.Take(limit);

        var raw = new List<PostDto>();
        foreach (var post in page) raw.Add(await mapper.ToDtoAsync(post, ct));

        var enriched = await mapper.WithStatsAsync(raw, ct);
        var next = rows.Count > limit
            ? Cursor.Encode(rows[limit - 1].PublishedAt ?? rows[limit - 1].CreatedAt, rows[limit - 1].Id)
            : null;
        return new CursorPageOf<PostDto>(enriched, next);
    }

    /// <summary>Posts published on a page (public entity, everyone can read them).</summary>
    public async Task<CursorPageOf<PostDto>> GetPagePostsAsync(
        Guid pageId, string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);

        if (!await db.Pages.AsNoTracking().AnyAsync(p => p.Id == pageId, ct))
            throw new KeyNotFoundException("Page not found.");

        var query = db.Posts.AsNoTracking().Include(p => p.Media)
            .Where(p => p.PageId == pageId && p.Status == PostStatus.Published)
            .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);

        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(p => p.PublishedAt < time || (p.PublishedAt == time && p.Id.CompareTo(id) < 0))
                .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);
        }

        var rows = await query.Take(limit + 1).ToListAsync(ct);
        var page = rows.Take(limit);

        var raw = new List<PostDto>();
        foreach (var post in page) raw.Add(await mapper.ToDtoAsync(post, ct));

        var enriched = await mapper.WithStatsAsync(raw, ct);
        var next = rows.Count > limit
            ? Cursor.Encode(rows[limit - 1].PublishedAt ?? rows[limit - 1].CreatedAt, rows[limit - 1].Id)
            : null;
        return new CursorPageOf<PostDto>(enriched, next);
    }

    /// <summary>Feed filtered by hashtag, scoped to the network of the viewer.</summary>
    public async Task<CursorPageOf<PostDto>> GetHashtagFeedAsync(
        string tag, string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);

        var normalized = tag.Trim().TrimStart('#').ToLowerInvariant();
        if (normalized.Length is 0 or > 50) return new CursorPageOf<PostDto>([], null);

        var me = ViewerId;
        var friendIds = await db.Friendships.AsNoTracking()
            .Where(f => f.Status == FriendshipStatus.Accepted && (f.UserLowId == me || f.UserHighId == me))
            .Select(f => f.UserLowId == me ? f.UserHighId : f.UserLowId).ToListAsync(ct);
        var followeeIds = await db.Follows.AsNoTracking()
            .Where(f => f.FollowerId == me).Select(f => f.FolloweeId).ToListAsync(ct);
        var authorIds = friendIds.Concat(followeeIds).Append(me).Distinct().ToList();

        var query = db.PostHashtags.AsNoTracking()
            .Where(h => h.Tag == normalized)
            .Join(db.Posts.AsNoTracking().Include(p => p.Media)
                    .Where(p => p.Status == PostStatus.Published && authorIds.Contains(p.AuthorUserId)),
                h => h.PostId, p => p.Id, (h, p) => p);

        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(p => p.PublishedAt < time || (p.PublishedAt == time && p.Id.CompareTo(id) < 0));
        }

        var candidates = await query
            .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id)
            .Take(limit * 2).ToListAsync(ct);

        var visible = await FilterVisibleAsync(candidates, limit, ct);

        var raw = new List<PostDto>();
        foreach (var post in visible) raw.Add(await mapper.ToDtoAsync(post, ct));

        var result = await mapper.WithStatsAsync(raw, ct);
        var last = visible.LastOrDefault();

        // the cursor carries PublishedAt because that is the column the query sorts on
        var next = last is null ? null : Cursor.Encode(last.PublishedAt ?? last.CreatedAt, last.Id);
        return new CursorPageOf<PostDto>(result, next);
    }

    // ---------- Search ----------

    public async Task<List<PostDto>> SearchPostsAsync(string query, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);

        var text = query.Trim();
        if (text.Length < 2) return [];
        var needle = text.ToLowerInvariant();

        var posts = await db.Posts.AsNoTracking()
            .Include(p => p.Media)
            .Where(p => p.Status == PostStatus.Published && p.TextContent != null && p.TextContent.ToLower().Contains(needle))
            .OrderByDescending(p => p.PublishedAt)
            .Take(limit * 2)
            .ToListAsync(ct);

        var visible = await FilterVisibleAsync(posts, limit, ct);

        var raw = new List<PostDto>();
        foreach (var post in visible) raw.Add(await mapper.ToDtoAsync(post, ct));

        return await mapper.WithStatsAsync(raw, ct);
    }

    /// <summary>Hashtags matching the term, most used first (server-side, over the tag index).</summary>
    public async Task<List<string>> SearchHashtagsAsync(string query, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 20);

        var needle = query.Trim().TrimStart('#').ToLowerInvariant();
        if (needle.Length < 1) return [];

        return await db.PostHashtags.AsNoTracking()
            .Where(h => h.Tag.Contains(needle))
            .GroupBy(h => h.Tag)
            .OrderByDescending(g => g.Count())
            .Select(g => g.Key)
            .Take(limit)
            .ToListAsync(ct);
    }

    /// <summary>Keeps the posts the viewer may see, until the list is full.</summary>
    private async Task<List<Post>> FilterVisibleAsync(List<Post> candidates, int limit, CancellationToken ct)
    {
        var visible = new List<Post>();
        foreach (var post in candidates)
        {
            if (!await access.CanViewAsync(post, ct)) continue;
            visible.Add(post);
            if (visible.Count >= limit) break;
        }

        return visible;
    }
}
