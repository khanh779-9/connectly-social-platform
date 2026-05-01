using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The lists of posts: the feed, the posts of a profile, group or page, and the polls.</summary>
public static class FeedEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapGet("/feed/home", async (string? cursor, int limit, [FromServices] FeedService feed, CancellationToken ct) =>
            Results.Ok(await feed.GetFeedAsync(cursor, limit, ct)));

        group.MapGet("/feed/hashtag/{tag}", async (string tag, string? cursor, int limit, [FromServices] FeedService feed, CancellationToken ct) =>
            Results.Ok(await feed.GetHashtagFeedAsync(tag, cursor, limit, ct)));

        group.MapGet("/users/{userId:guid}/posts", async (Guid userId, string? cursor, int limit, [FromServices] FeedService feed, CancellationToken ct) =>
            Results.Ok(await feed.GetProfilePostsAsync(userId, cursor, limit, ct)));

        group.MapGet("/groups/{groupId:guid}/posts", async (Guid groupId, string? cursor, int limit, [FromServices] FeedService feed, CancellationToken ct) =>
        {
            try { return Results.Ok(await feed.GetGroupPostsAsync(groupId, cursor, limit, ct)); }
            catch (Exception ex) { return ex.ToProblem("group_state"); }
        });

        group.MapGet("/pages/{pageId:guid}/posts", async (Guid pageId, string? cursor, int limit, [FromServices] FeedService feed, CancellationToken ct) =>
        {
            try { return Results.Ok(await feed.GetPagePostsAsync(pageId, cursor, limit, ct)); }
            catch (Exception ex) { return ex.ToProblem("page_state"); }
        });

        group.MapPut("/posts/{postId:guid}/poll/vote", async (Guid postId, [FromBody] PollVoteRequest request, [FromServices] PollService polls, CancellationToken ct) =>
        {
            try { return Results.Ok(await polls.VotePollAsync(postId, request, ct)); }
            catch (Exception ex) { return ex.ToProblem("poll_state"); }
        });

        group.MapDelete("/posts/{postId:guid}/poll/vote", async (Guid postId, [FromServices] PollService polls, CancellationToken ct) =>
        {
            try { return Results.Ok(await polls.VotePollAsync(postId, new PollVoteRequest([]), ct)); }
            catch (Exception ex) { return ex.ToProblem("poll_state"); }
        });
    }
}
