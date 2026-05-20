using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The search page: one call returns every kind of result.</summary>
public static class SearchEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapGet("/search", async (
            string? q,
            int limit,
            [FromServices] ProfileService profile,
            [FromServices] FeedService feed,
            [FromServices] GroupService groups,
            [FromServices] PageService pages,
            [FromServices] EventService events,
            CancellationToken ct) =>
        {
            var query = (q ?? string.Empty).Trim();
            if (query.Length < 2) return Results.Ok(new SearchResultDto([], [], [], [], [], []));

            var take = limit <= 0 ? 10 : Math.Clamp(limit, 1, 30);

            var users = await profile.SearchUsersAsync(query, take, ct);
            var foundPosts = await feed.SearchPostsAsync(query, take, ct);
            var foundGroups = await groups.SearchGroupsAsync(query, Math.Min(take, 10), ct);
            var foundPages = await pages.SearchPagesAsync(query, Math.Min(take, 10), ct);
            var foundEvents = await events.SearchEventsAsync(query, Math.Min(take, 10), ct);
            var hashtags = await feed.SearchHashtagsAsync(query, 20, ct);

            return Results.Ok(new SearchResultDto(users, foundPosts, foundGroups, foundPages, foundEvents, hashtags));
        });
    }
}
