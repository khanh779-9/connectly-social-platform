using BuildingBlocks.Auth;
using BuildingBlocks.Storage;
using Microsoft.EntityFrameworkCore;
using Social.Domain;
using Social.Persistence;

namespace Social.Features;

/// <summary>
/// Turns database rows into the DTOs the API returns. Shared by every service
/// that answers with posts, so the counts and viewer flags stay the same everywhere.
/// </summary>
public class PostMapper(
    SocialDbContext db,
    ICurrentUser currentUser,
    IFileStorage storage)
{
    private Guid ViewerId => currentUser.RequireUserId();

    /// <summary>Builds one post without counts; the caller adds them in a batch.</summary>
    public async Task<PostDto> ToDtoAsync(Post post, CancellationToken ct)
    {
        var media = new List<PostMediaDto>();
        foreach (var item in post.Media.OrderBy(x => x.SortOrder))
        {
            var url = await storage.GenerateDownloadUrlAsync(item.ObjectKey, ct: ct);
            media.Add(new PostMediaDto(item.Id, item.ObjectKey, url, item.ContentType, item.SortOrder));
        }

        return new PostDto(
            post.Id,
            post.AuthorUserId,
            post.TextContent,
            post.Visibility.ToString(),
            post.Status.ToString(),
            post.CreatedAt,
            media,
            GroupId: post.GroupId,
            PageId: post.PageId,
            EditedAt: post.EditedAt);
    }

    /// <summary>Adds counts and viewer flags to a page of posts in five queries (no N+1).</summary>
    public async Task<List<PostDto>> WithStatsAsync(List<PostDto> dtos, CancellationToken ct)
    {
        if (dtos.Count == 0) return dtos;

        var ids = dtos.Select(d => d.Id).ToList();
        var me = ViewerId;

        var reactionCounts = await db.PostReactions.AsNoTracking()
            .Where(r => ids.Contains(r.PostId))
            .GroupBy(r => r.PostId)
            .Select(g => new { PostId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.PostId, x => x.Count, ct);

        var reactionBreakdowns = await db.PostReactions.AsNoTracking()
            .Where(r => ids.Contains(r.PostId))
            .GroupBy(r => new { r.PostId, r.ReactionType })
            .Select(g => new { g.Key.PostId, g.Key.ReactionType, Count = g.Count() })
            .ToListAsync(ct);

        var commentCounts = await db.Comments.AsNoTracking()
            .Where(c => ids.Contains(c.PostId) && c.Status == "active")
            .GroupBy(c => c.PostId)
            .Select(g => new { PostId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.PostId, x => x.Count, ct);

        var shareCounts = await db.Shares.AsNoTracking()
            .Where(s => ids.Contains(s.PostId))
            .GroupBy(s => s.PostId)
            .Select(g => new { PostId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.PostId, x => x.Count, ct);

        var myReactions = await db.PostReactions.AsNoTracking()
            .Where(r => ids.Contains(r.PostId) && r.UserId == me)
            .ToDictionaryAsync(r => r.PostId, r => r.ReactionType, ct);

        var myBookmarks = await db.Bookmarks.AsNoTracking()
            .Where(b => ids.Contains(b.PostId) && b.UserId == me)
            .Select(b => b.PostId)
            .ToListAsync(ct);
        var bookmarked = myBookmarks.ToHashSet();

        var breakdownsByPost = reactionBreakdowns
            .GroupBy(x => x.PostId)
            .ToDictionary(g => g.Key, g => g
                .OrderByDescending(x => x.Count)
                .Select(x => new ReactionBreakdownDto(x.ReactionType, x.Count))
                .ToList());

        var polls = await LoadPollsAsync(ids, ct);

        var mentionRows = await db.PostMentions.AsNoTracking()
            .Where(m => ids.Contains(m.PostId))
            .ToListAsync(ct);
        var mentionedUserIds = mentionRows.Select(m => m.UserId).Distinct().ToList();
        var mentionUsers = await db.Profiles.AsNoTracking()
            .Where(p => p.Username != null && mentionedUserIds.Contains(p.UserId))
            .Select(p => new { p.UserId, p.Username })
            .ToListAsync(ct);
        var usernameByUser = mentionUsers.ToDictionary(x => x.UserId, x => x.Username!);
        var mentionsByPost = mentionRows
            .GroupBy(m => m.PostId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(m => new MentionDto(m.UserId, usernameByUser.GetValueOrDefault(m.UserId, "")))
                    .Where(m => m.Username.Length > 0)
                    .ToList());

        return dtos.Select(d => d with
        {
            ReactionCount = reactionCounts.GetValueOrDefault(d.Id),
            CommentCount = commentCounts.GetValueOrDefault(d.Id),
            ViewerReaction = myReactions.GetValueOrDefault(d.Id),
            ViewerBookmarked = bookmarked.Contains(d.Id),
            ReactionBreakdowns = breakdownsByPost.GetValueOrDefault(d.Id, []),
            ShareCount = shareCounts.GetValueOrDefault(d.Id),
            Poll = polls.GetValueOrDefault(d.Id),
            Mentions = mentionsByPost.GetValueOrDefault(d.Id, [])
        }).ToList();
    }

    /// <summary>Loads polls for a batch of posts (three queries, no N+1).</summary>
    public async Task<Dictionary<Guid, PollDto>> LoadPollsAsync(IReadOnlyCollection<Guid> postIds, CancellationToken ct)
    {
        if (postIds.Count == 0) return [];

        var me = ViewerId;

        var polls = await db.Polls.AsNoTracking()
            .Where(p => postIds.Contains(p.PostId))
            .ToListAsync(ct);
        if (polls.Count == 0) return [];

        var options = await db.PollOptions.AsNoTracking()
            .Where(o => postIds.Contains(o.PostId))
            .OrderBy(o => o.PostId).ThenBy(o => o.SortOrder)
            .ToListAsync(ct);
        var counts = await db.PollVotes.AsNoTracking()
            .Where(v => postIds.Contains(v.PostId))
            .GroupBy(v => v.OptionId)
            .Select(g => new { OptionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.OptionId, x => x.Count, ct);
        var mine = await db.PollVotes.AsNoTracking()
            .Where(v => postIds.Contains(v.PostId) && v.UserId == me)
            .Select(v => new { v.PostId, v.OptionId })
            .ToListAsync(ct);

        var result = new Dictionary<Guid, PollDto>();
        foreach (var poll in polls)
        {
            var pollOptions = options.Where(o => o.PostId == poll.PostId).ToList();
            var total = pollOptions.Sum(o => counts.GetValueOrDefault(o.Id));

            var pollOptionDtos = pollOptions.Select(o => new PollOptionDto(
                o.Id,
                o.Text,
                counts.GetValueOrDefault(o.Id),
                mine.Any(m => m.PostId == poll.PostId && m.OptionId == o.Id))).ToList();

            result[poll.PostId] = new PollDto(
                poll.PostId,
                poll.Question,
                poll.AllowMultiple,
                pollOptionDtos,
                total);
        }

        return result;
    }
}
