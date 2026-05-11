using BuildingBlocks.Auth;
using BuildingBlocks.Messaging;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Social;
using Microsoft.EntityFrameworkCore;
using Social.Domain;
using Social.Persistence;

namespace Social.Features;

/// <summary>The poll of a post: casting a vote and reading the result.</summary>
public class PollService(
    SocialDbContext db,
    ICurrentUser currentUser,
    PostMapper mapper,
    PostAccess access)
{
    private Guid ViewerId => currentUser.RequireUserId();

    /// <summary>Casts (or replaces) the vote of the viewer. An empty option list clears the vote.</summary>
    public async Task<PollDto> VotePollAsync(Guid postId, PollVoteRequest request, CancellationToken ct)
    {
        var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == postId, ct)
            ?? throw new KeyNotFoundException("Post not found.");
        if (post.Status != PostStatus.Published || !await access.CanViewAsync(post, ct))
            throw new UnauthorizedAccessException("You cannot vote on this poll.");

        var poll = await db.Polls.AsNoTracking().SingleOrDefaultAsync(p => p.PostId == postId, ct)
            ?? throw new KeyNotFoundException("This post has no poll.");

        var optionIds = request.OptionIds.Distinct().ToList();
        var validOptions = await db.PollOptions.AsNoTracking()
            .Where(o => o.PostId == postId && optionIds.Contains(o.Id))
            .Select(o => o.Id)
            .ToListAsync(ct);
        if (validOptions.Count != optionIds.Count)
            throw new ArgumentException("Some poll options do not exist.");
        if (!poll.AllowMultiple && validOptions.Count > 1)
            throw new ArgumentException("This poll accepts a single choice.");

        var me = ViewerId;
        var now = DateTimeOffset.UtcNow;

        // the previous votes are replaced through the change tracker: a bulk delete
        // would commit on its own, outside the transaction of the new votes
        var previousVotes = await db.PollVotes
            .Where(v => v.PostId == postId && v.UserId == me).ToListAsync(ct);
        var wanted = validOptions.ToHashSet();
        foreach (var vote in previousVotes.Where(v => !wanted.Contains(v.OptionId)))
            db.PollVotes.Remove(vote);

        var alreadyVoted = previousVotes.Select(v => v.OptionId).ToHashSet();
        foreach (var optionId in validOptions.Where(o => !alreadyVoted.Contains(o)))
            db.PollVotes.Add(new PollVote { PostId = postId, OptionId = optionId, UserId = me, CreatedAt = now });

        if (validOptions.Count > 0)
        {
            db.EnqueueEvent(EventTypes.Social.PollVoted,
                new PollVotedV1(postId, post.AuthorUserId, me, validOptions.Count), EventProducer.Name);
        }

        await db.SaveChangesAsync(ct);

        var polls = await mapper.LoadPollsAsync([postId], ct);
        return polls[postId];
    }
}
