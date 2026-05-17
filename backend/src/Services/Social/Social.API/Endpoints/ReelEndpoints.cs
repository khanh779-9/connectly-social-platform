using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The short vertical videos.</summary>
public static class ReelEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapPost("/reels", async ([FromBody] CreateReelRequest request, [FromServices] ReelService reels, CancellationToken ct) =>
        {
            try { return Results.Ok(await reels.CreateReelAsync(request, ct)); }
            catch (Exception ex) { return ex.ToProblem("reel_state"); }
        });

        group.MapGet("/reels", async (string? tab, string? cursor, int limit, [FromServices] ReelService reels, CancellationToken ct) =>
        {
            var feedTab = string.Equals(tab, "following", StringComparison.OrdinalIgnoreCase)
                ? ReelFeedTab.Following
                : ReelFeedTab.ForYou;
            return Results.Ok(await reels.GetReelFeedAsync(feedTab, cursor, limit <= 0 ? 10 : limit, ct));
        });

        group.MapGet("/reels/{reelId:guid}", async (Guid reelId, [FromServices] ReelService reels, CancellationToken ct) =>
        {
            var reel = await reels.GetReelAsync(reelId, ct);
            return reel is null ? Results.NotFound() : Results.Ok(reel);
        });

        group.MapGet("/profiles/{userId:guid}/reels", async (Guid userId, string? cursor, int limit, [FromServices] ReelService reels, CancellationToken ct) =>
            Results.Ok(await reels.GetProfileReelsAsync(userId, cursor, limit <= 0 ? 12 : limit, ct)));

        group.MapPost("/reels/{reelId:guid}/view", async (Guid reelId, [FromBody] RecordReelViewRequest request, [FromServices] ReelService reels, CancellationToken ct) =>
        {
            try { return Results.Ok(await reels.RecordViewAsync(reelId, request, ct)); }
            catch (Exception ex) { return ex.ToProblem("reel_state"); }
        });

        group.MapDelete("/reels/{reelId:guid}", async (Guid reelId, [FromServices] ReelService reels, CancellationToken ct) =>
        {
            try { await reels.DeleteReelAsync(reelId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("reel_state"); }
        });
    }
}
