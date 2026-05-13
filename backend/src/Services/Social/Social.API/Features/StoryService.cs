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

public sealed record CreateStoryRequest(Guid MediaAssetId, string? Caption, PostVisibility Visibility = PostVisibility.Friends);
public sealed record StoryDto(
    Guid Id,
    Guid AuthorUserId,
    string Url,
    string ContentType,
    string? Caption,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt,
    int ViewCount = 0,
    bool ViewerViewed = false,
    string Visibility = "Friends");
public sealed record UpdateStoryRequest(PostVisibility? Visibility = null, string? Caption = null);
public sealed record StoryAuthorDto(Guid UserId, List<StoryDto> Stories, bool HasUnviewed);
public sealed record StoryViewDto(Guid ViewerUserId, DateTimeOffset ViewedAt);
public sealed record CreateHighlightRequest(string Title);
public sealed record HighlightDto(
    Guid Id,
    Guid OwnerUserId,
    string Title,
    DateTimeOffset CreatedAt,
    string? CoverUrl = null,
    int StoryCount = 0);

public class StoryService(
    SocialDbContext db,
    ICurrentUser currentUser,
    IFileStorage storage,
    ILogger<StoryService> logger)
{
    /// <summary>Producer identity stamped into event envelopes; single source of truth is EventProducer.</summary>
    public const string Producer = EventProducer.Name;

    private static readonly TimeSpan Lifetime = BuildingBlocks.Env.ConnectlyEnv.StoryTtl();
    private Guid ViewerId => currentUser.RequireUserId();

    /// <summary>Publishes a story for 24 hours from an uploaded media asset.</summary>
    public async Task<StoryDto> CreateStoryAsync(CreateStoryRequest request, CancellationToken ct)
    {
        var me = ViewerId;
        var asset = await db.MediaAssets.AsNoTracking()
            .SingleOrDefaultAsync(m => m.Id == request.MediaAssetId, ct)
            ?? throw new KeyNotFoundException("Media asset not found.");
        if (asset.OwnerUserId != me) throw new UnauthorizedAccessException("You can only publish your own media.");
        if (asset.Status != "ready") throw new ArgumentException("The upload is not completed yet.");

        var now = DateTimeOffset.UtcNow;
        var story = new Story
        {
            AuthorUserId = me,
            MediaAssetId = asset.Id,
            Caption = request.Caption?.Trim(),
            Visibility = request.Visibility,
            CreatedAt = now,
            ExpiresAt = now.Add(Lifetime)
        };
        db.Stories.Add(story);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Story {StoryId} published by {User}", story.Id, me);
        return await ToDtoAsync(story, ct);
    }

    public async Task<StoryDto> GetStoryAsync(Guid storyId, CancellationToken ct)
    {
        var story = await db.Stories.AsNoTracking().SingleOrDefaultAsync(s => s.Id == storyId, ct)
            ?? throw new KeyNotFoundException("Story not found.");
        await EnsureVisibleAsync(story, ct);
        return await ToDtoAsync(story, ct);
    }

    /// <summary>
    /// Story rail: the viewer's own stories plus the stories of friends, grouped by author.
    /// Only unexpired stories are returned.
    /// </summary>
    public async Task<List<StoryAuthorDto>> GetStoryFeedAsync(CancellationToken ct)
    {
        var me = ViewerId;
        var now = DateTimeOffset.UtcNow;

        var friendIds = await db.Friendships.AsNoTracking()
            .Where(f => f.Status == FriendshipStatus.Accepted && (f.UserLowId == me || f.UserHighId == me))
            .Select(f => f.UserLowId == me ? f.UserHighId : f.UserLowId)
            .ToListAsync(ct);

        var authorIds = friendIds.Append(me).Distinct().ToList();
        var stories = await db.Stories.AsNoTracking()
            .Where(s => s.ExpiresAt != null && s.ExpiresAt > now
                        // "only me" stories never show up in someone else's rail
                        && (s.AuthorUserId == me || s.Visibility != PostVisibility.OnlyMe)
                        // own + friends' stories, plus public stories of anyone
                        && (s.AuthorUserId == me
                            || s.Visibility == PostVisibility.Public
                            || authorIds.Contains(s.AuthorUserId)))
            .OrderBy(s => s.AuthorUserId).ThenBy(s => s.CreatedAt)
            .ToListAsync(ct);
        if (stories.Count == 0) return [];

        var viewCounts = await db.StoryViews.AsNoTracking()
            .Where(v => stories.Select(s => s.Id).Contains(v.StoryId))
            .GroupBy(v => v.StoryId)
            .Select(g => new { StoryId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StoryId, x => x.Count, ct);
        var viewed = await db.StoryViews.AsNoTracking()
            .Where(v => v.ViewerUserId == me && stories.Select(s => s.Id).Contains(v.StoryId))
            .Select(v => v.StoryId)
            .ToListAsync(ct);

        var media = await db.MediaAssets.AsNoTracking()
            .Where(m => stories.Select(s => s.MediaAssetId).Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var byAuthor = stories.GroupBy(s => s.AuthorUserId).ToList();
        var result = new List<StoryAuthorDto>();
        foreach (var group in byAuthor)
        {
            var dtos = new List<StoryDto>();
            foreach (var story in group)
            {
                if (!media.TryGetValue(story.MediaAssetId, out var asset)) continue;
                var url = await storage.GenerateDownloadUrlAsync(asset.ObjectKey, ct: ct);
                dtos.Add(new StoryDto(
                    story.Id,
                    story.AuthorUserId,
                    url,
                    asset.ContentType,
                    story.Caption,
                    story.CreatedAt,
                    story.ExpiresAt,
                    viewCounts.GetValueOrDefault(story.Id),
                    viewed.Contains(story.Id),
                    story.Visibility.ToString()));
            }
            if (dtos.Count == 0) continue;
            result.Add(new StoryAuthorDto(group.Key, dtos, dtos.Any(s => !s.ViewerViewed)));
        }

        // own stories first, then friends by recency
        return result
            .OrderByDescending(a => a.UserId == me)
            .ThenByDescending(a => a.Stories.Max(s => s.CreatedAt))
            .ToList();
    }

    /// <summary>Marks the story as seen by the viewer (idempotent).</summary>
    public async Task<StoryDto> ViewStoryAsync(Guid storyId, CancellationToken ct)
    {
        var story = await db.Stories.AsNoTracking().SingleOrDefaultAsync(s => s.Id == storyId, ct)
            ?? throw new KeyNotFoundException("Story not found.");
        await EnsureVisibleAsync(story, ct);

        var me = ViewerId;
        var existing = await db.StoryViews.FindAsync([storyId, me]);
        if (existing is null)
        {
            db.StoryViews.Add(new StoryView { StoryId = storyId, ViewerUserId = me, ViewedAt = DateTimeOffset.UtcNow });
            db.EnqueueEvent(EventTypes.Social.StoryViewed,
                new StoryViewedV1(story.Id, story.AuthorUserId, me, story.Caption?[..Math.Min(story.Caption?.Length ?? 0, 120)]), Producer);
            await db.SaveChangesAsync(ct);
        }
        return await ToDtoAsync(story, ct);
    }

    /// <summary>Owner-only: change who can see a story (and optionally its caption).</summary>
    public async Task<StoryDto> UpdateStoryAsync(Guid storyId, UpdateStoryRequest request, CancellationToken ct)
    {
        var story = await db.Stories.SingleOrDefaultAsync(s => s.Id == storyId, ct)
            ?? throw new KeyNotFoundException("Story not found.");
        if (story.AuthorUserId != ViewerId) throw new UnauthorizedAccessException("Only the author can edit a story.");
        if (request.Visibility is not null) story.Visibility = request.Visibility.Value;
        if (request.Caption is not null)
        {
            var caption = request.Caption.Trim();
            story.Caption = caption.Length == 0 ? null : caption;
        }
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Story {StoryId} updated by {User}", story.Id, ViewerId);
        return await ToDtoAsync(story, ct);
    }

    public async Task DeleteStoryAsync(Guid storyId, CancellationToken ct)
    {
        var story = await db.Stories.SingleOrDefaultAsync(s => s.Id == storyId, ct)
            ?? throw new KeyNotFoundException("Story not found.");
        if (story.AuthorUserId != ViewerId) throw new UnauthorizedAccessException("Only the author can delete a story.");
        await db.HighlightStories.Where(h => h.StoryId == storyId).ExecuteDeleteAsync(ct);
        await db.StoryViews.Where(v => v.StoryId == storyId).ExecuteDeleteAsync(ct);
        db.Stories.Remove(story);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Who watched a story — only the author may look at this list.</summary>
    public async Task<List<StoryViewDto>> ListViewsAsync(Guid storyId, CancellationToken ct)
    {
        var story = await db.Stories.AsNoTracking().SingleOrDefaultAsync(s => s.Id == storyId, ct)
            ?? throw new KeyNotFoundException("Story not found.");
        if (story.AuthorUserId != ViewerId) throw new UnauthorizedAccessException("Only the author can see the viewers.");
        var rows = await db.StoryViews.AsNoTracking()
            .Where(v => v.StoryId == storyId)
            .OrderByDescending(v => v.ViewedAt)
            .ToListAsync(ct);
        return rows.Select(v => new StoryViewDto(v.ViewerUserId, v.ViewedAt)).ToList();
    }

    // ---------- Highlights ----------
    public async Task<HighlightDto> CreateHighlightAsync(CreateHighlightRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 60)
            throw new ArgumentException("Highlight title is empty or too long.");
        var highlight = new Highlight
        {
            OwnerUserId = ViewerId,
            Title = request.Title.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Highlights.Add(highlight);
        await db.SaveChangesAsync(ct);
        return ToHighlightDto(highlight);
    }

    public async Task<List<HighlightDto>> ListMyHighlightsAsync(CancellationToken ct)
    {
        var rows = await db.Highlights.AsNoTracking()
            .Where(h => h.OwnerUserId == ViewerId)
            .OrderBy(h => h.CreatedAt)
            .ToListAsync(ct);
        return await WithHighlightDetailsAsync(rows, ct);
    }

    /// <summary>Highlights owned by a given user — shown on their profile.</summary>
    public async Task<List<HighlightDto>> ListHighlightsAsync(Guid ownerUserId, CancellationToken ct)
    {
        var rows = await db.Highlights.AsNoTracking()
            .Where(h => h.OwnerUserId == ownerUserId)
            .OrderBy(h => h.CreatedAt)
            .ToListAsync(ct);
        var details = await WithHighlightDetailsAsync(rows, ct);
        // for someone else's profile, only highlights with a visible story are listed
        if (ownerUserId == ViewerId) return details;
        return details.Where(h => h.StoryCount > 0).ToList();
    }

    /// <summary>Adds the cover image and story count to a set of highlights.</summary>
    private async Task<List<HighlightDto>> WithHighlightDetailsAsync(List<Highlight> rows, CancellationToken ct)
    {
        if (rows.Count == 0) return [];
        var ids = rows.Select(h => h.Id).ToList();

        // stories of each highlight, in order
        var entries = await db.HighlightStories.AsNoTracking()
            .Where(h => ids.Contains(h.HighlightId))
            .OrderBy(h => h.HighlightId).ThenBy(h => h.SortOrder)
            .Join(db.Stories.AsNoTracking(), h => h.StoryId, s => s.Id, (h, s) => new { h.HighlightId, s })
            .ToListAsync(ct);

        // a highlight of another user only exposes the stories the viewer may see
        var visibleEntries = new List<(Guid HighlightId, Story Story)>();
        foreach (var entry in entries)
        {
            if (await CanSeeAsync(entry.s, ct)) visibleEntries.Add((entry.HighlightId, entry.s));
        }

        var counts = visibleEntries
            .GroupBy(e => e.HighlightId)
            .ToDictionary(g => g.Key, g => g.Count());
        var firstMedia = visibleEntries
            .GroupBy(e => e.HighlightId)
            .ToDictionary(g => g.Key, g => g.First().Story.MediaAssetId);
        var assets = await db.MediaAssets.AsNoTracking()
            .Where(m => firstMedia.Values.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var result = new List<HighlightDto>();
        foreach (var highlight in rows)
        {
            string? cover = null;
            if (firstMedia.TryGetValue(highlight.Id, out var mediaId) && assets.TryGetValue(mediaId, out var asset))
                cover = await storage.GenerateDownloadUrlAsync(asset.ObjectKey, ct: ct);
            result.Add(ToHighlightDto(highlight) with
            {
                CoverUrl = cover,
                StoryCount = counts.GetValueOrDefault(highlight.Id)
            });
        }
        return result;
    }

    private static HighlightDto ToHighlightDto(Highlight highlight) => new(
        highlight.Id,
        highlight.OwnerUserId,
        highlight.Title,
        highlight.CreatedAt);

    /// <summary>Archives a story into a highlight (the story leaves the 24h rail and becomes permanent).</summary>
    public async Task AddStoryToHighlightAsync(Guid highlightId, Guid storyId, CancellationToken ct)
    {
        var highlight = await db.Highlights.AsNoTracking().SingleOrDefaultAsync(h => h.Id == highlightId, ct)
            ?? throw new KeyNotFoundException("Highlight not found.");
        if (highlight.OwnerUserId != ViewerId) throw new UnauthorizedAccessException("Not your highlight.");

        var story = await db.Stories.SingleOrDefaultAsync(s => s.Id == storyId, ct)
            ?? throw new KeyNotFoundException("Story not found.");
        if (story.AuthorUserId != ViewerId) throw new UnauthorizedAccessException("Only your own stories can be archived.");

        var count = await db.HighlightStories.CountAsync(h => h.HighlightId == highlightId, ct);
        if (!await db.HighlightStories.AnyAsync(h => h.HighlightId == highlightId && h.StoryId == storyId, ct))
            db.HighlightStories.Add(new HighlightStory { HighlightId = highlightId, StoryId = storyId, SortOrder = count });
        story.ExpiresAt = null; // archived: no longer shown in the story rail
        await db.SaveChangesAsync(ct);
    }

    public async Task RemoveStoryFromHighlightAsync(Guid highlightId, Guid storyId, CancellationToken ct)
    {
        var highlight = await db.Highlights.AsNoTracking().SingleOrDefaultAsync(h => h.Id == highlightId, ct)
            ?? throw new KeyNotFoundException("Highlight not found.");
        if (highlight.OwnerUserId != ViewerId) throw new UnauthorizedAccessException("Not your highlight.");
        await db.HighlightStories.Where(h => h.HighlightId == highlightId && h.StoryId == storyId)
            .ExecuteDeleteAsync(ct);
        await RestoreExpiryAsync(storyId, ct);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// A story that no longer belongs to any highlight goes back to the 24h rail
    /// when it has not expired yet (archived stories carry a null expiry).
    /// </summary>
    private async Task RestoreExpiryAsync(Guid storyId, CancellationToken ct)
    {
        var stillArchived = await db.HighlightStories.AsNoTracking()
            .AnyAsync(h => h.StoryId == storyId, ct);
        if (stillArchived) return;

        var story = await db.Stories.SingleOrDefaultAsync(s => s.Id == storyId, ct);
        if (story is null || story.ExpiresAt is not null) return;

        var expiry = story.CreatedAt.Add(Lifetime);
        story.ExpiresAt = expiry > DateTimeOffset.UtcNow ? expiry : null;
    }

    public async Task DeleteHighlightAsync(Guid highlightId, CancellationToken ct)
    {
        var highlight = await db.Highlights.SingleOrDefaultAsync(h => h.Id == highlightId, ct)
            ?? throw new KeyNotFoundException("Highlight not found.");
        if (highlight.OwnerUserId != ViewerId) throw new UnauthorizedAccessException("Not your highlight.");

        var storyIds = await db.HighlightStories.AsNoTracking()
            .Where(h => h.HighlightId == highlightId)
            .Select(h => h.StoryId)
            .ToListAsync(ct);
        await db.HighlightStories.Where(h => h.HighlightId == highlightId).ExecuteDeleteAsync(ct);
        db.Highlights.Remove(highlight);
        await db.SaveChangesAsync(ct);

        foreach (var storyId in storyIds) await RestoreExpiryAsync(storyId, ct);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Stories archived in a highlight (ordered), with their media URLs.</summary>
    public async Task<List<StoryDto>> GetHighlightStoriesAsync(Guid highlightId, CancellationToken ct)
    {
        var highlight = await db.Highlights.AsNoTracking().SingleOrDefaultAsync(h => h.Id == highlightId, ct)
            ?? throw new KeyNotFoundException("Highlight not found.");
        var ownerId = highlight.OwnerUserId;

        var rows = await db.HighlightStories.AsNoTracking()
            .Where(h => h.HighlightId == highlightId)
            .OrderBy(h => h.SortOrder)
            .Join(db.Stories.AsNoTracking(), h => h.StoryId, s => s.Id, (h, s) => s)
            .ToListAsync(ct);
        if (rows.Count == 0) return [];

        // highlights of other users only expose the stories the viewer may see
        var visible = new List<Story>();
        foreach (var story in rows)
        {
            if (await CanSeeAsync(story, ct)) visible.Add(story);
        }
        if (visible.Count == 0) return [];
        rows = visible;

        var media = await db.MediaAssets.AsNoTracking()
            .Where(m => rows.Select(s => s.MediaAssetId).Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);
        var counts = await db.StoryViews.AsNoTracking()
            .Where(v => rows.Select(s => s.Id).Contains(v.StoryId))
            .GroupBy(v => v.StoryId)
            .Select(g => new { StoryId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StoryId, x => x.Count, ct);
        var mine = await db.StoryViews.AsNoTracking()
            .Where(v => v.ViewerUserId == ViewerId && rows.Select(s => s.Id).Contains(v.StoryId))
            .Select(v => v.StoryId)
            .ToListAsync(ct);

        var result = new List<StoryDto>();
        foreach (var story in rows)
        {
            if (!media.TryGetValue(story.MediaAssetId, out var asset)) continue;
            var url = await storage.GenerateDownloadUrlAsync(asset.ObjectKey, ct: ct);
            result.Add(new StoryDto(
                story.Id,
                story.AuthorUserId,
                url,
                asset.ContentType,
                story.Caption,
                story.CreatedAt,
                story.ExpiresAt,
                counts.GetValueOrDefault(story.Id),
                mine.Contains(story.Id),
                story.Visibility.ToString()));
        }
        return result;
    }

    // ---------- helpers ----------
    private async Task<StoryDto> ToDtoAsync(Story story, CancellationToken ct)
    {
        var asset = await db.MediaAssets.AsNoTracking().SingleAsync(m => m.Id == story.MediaAssetId, ct);
        var url = await storage.GenerateDownloadUrlAsync(asset.ObjectKey, ct: ct);
        var viewCount = await db.StoryViews.AsNoTracking().CountAsync(v => v.StoryId == story.Id, ct);
        var viewerViewed = await db.StoryViews.AsNoTracking()
            .AnyAsync(v => v.StoryId == story.Id && v.ViewerUserId == ViewerId, ct);
        return new StoryDto(
            story.Id,
            story.AuthorUserId,
            url,
            asset.ContentType,
            story.Caption,
            story.CreatedAt,
            story.ExpiresAt,
            viewCount,
            viewerViewed,
            story.Visibility.ToString());
    }

    /// <summary>Stories expire after 24h; visibility follows friends / public / only-me.</summary>
    private async Task EnsureVisibleAsync(Story story, CancellationToken ct)
    {
        if (story.ExpiresAt is { } expires && expires <= DateTimeOffset.UtcNow)
            throw new KeyNotFoundException("Story expired.");
        if (!await CanSeeAsync(story, ct))
            throw new UnauthorizedAccessException("You cannot see this story.");
    }

    /// <summary>Visibility check without the expiry rule (archived stories live forever inside highlights).</summary>
    private async Task<bool> CanSeeAsync(Story story, CancellationToken ct)
    {
        if (story.AuthorUserId == ViewerId) return true;
        if (story.Visibility == PostVisibility.OnlyMe) return false;
        if (story.Visibility == PostVisibility.Friends)
        {
            return await db.Friendships.AsNoTracking().AnyAsync(f =>
                f.Status == FriendshipStatus.Accepted &&
                ((f.UserLowId == ViewerId && f.UserHighId == story.AuthorUserId) ||
                 (f.UserHighId == ViewerId && f.UserLowId == story.AuthorUserId)), ct);
        }
        return true;
    }

}
