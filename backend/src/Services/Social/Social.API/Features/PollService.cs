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

