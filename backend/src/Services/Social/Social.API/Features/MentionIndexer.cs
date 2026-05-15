using BuildingBlocks.Messaging;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Social;
using Social.Domain;
using Social.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Social.Features;

/// <summary>
/// Keeps the mention index in sync with the content body and notifies the
/// tagged users. Shared by posts, comments and reels.
/// </summary>
public static class MentionIndexer
{
    /// <summary>Producer identity stamped into event envelopes; single source of truth is EventProducer.</summary>
    public const string Producer = EventProducer.Name;

    /// <summary>
    /// Replaces the mention index of a post and returns the resolved users.
    /// Only users that were newly tagged (and not the author) are notified.
    /// </summary>
    public static async Task<List<MentionDto>> IndexPostMentionsAsync(
        SocialDbContext db, Guid postId, string? text, Guid authorUserId, bool notify, CancellationToken ct)
    {
        var usernames = MentionParser.ExtractUsernames(text);
        // the index is replaced through the change tracker: a bulk delete would commit
        // on its own, outside the transaction of the new rows
        var existing = await db.PostMentions.Where(m => m.PostId == postId).ToListAsync(ct);
        var previously = existing.Select(m => m.UserId).ToList();

        var resolved = await ResolveAsync(db, usernames, ct);

        var wanted = resolved.Select(m => m.UserId).ToHashSet();
        foreach (var row in existing.Where(m => !wanted.Contains(m.UserId)))
            db.PostMentions.Remove(row);

        var present = existing.Select(m => m.UserId).ToHashSet();
        var now = DateTimeOffset.UtcNow;
        foreach (var mention in resolved.Where(m => !present.Contains(m.UserId)))
            db.PostMentions.Add(new PostMention { PostId = postId, UserId = mention.UserId, CreatedAt = now });

        if (notify)
        {
            var preview = text?[..Math.Min(text?.Length ?? 0, 120)];
            foreach (var mention in resolved.Where(m => !previously.Contains(m.UserId) && m.UserId != authorUserId))
                db.EnqueueEvent(EventTypes.Social.UserMentioned,
                    new UserMentionedV1(mention.UserId, authorUserId, postId, null, preview), Producer);
        }

        return resolved;
    }

    /// <summary>Replaces the mention index of a comment and notifies newly tagged users.</summary>
    public static async Task<List<MentionDto>> IndexCommentMentionsAsync(
        SocialDbContext db, Guid commentId, Guid postId, string? content, Guid authorUserId, CancellationToken ct)
    {
        var usernames = MentionParser.ExtractUsernames(content);
        // the index is replaced through the change tracker: a bulk delete would commit
        // on its own, outside the transaction of the new rows
        var existing = await db.CommentMentions.Where(m => m.CommentId == commentId).ToListAsync(ct);
        var previously = existing.Select(m => m.UserId).ToList();

