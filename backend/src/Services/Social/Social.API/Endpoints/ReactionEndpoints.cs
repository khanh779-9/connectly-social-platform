using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The emoji reactions on a post.</summary>
public static class ReactionEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapPut("/posts/{postId:guid}/reaction", async (Guid postId, [FromBody] SetReactionRequest request, [FromServices] ReactionService reactions, CancellationToken ct) =>
        {
            try { await reactions.SetReactionAsync(postId, request, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("reaction_state"); }
        });

        group.MapDelete("/posts/{postId:guid}/reaction", async (Guid postId, [FromServices] ReactionService reactions, CancellationToken ct) =>
        {
            try { await reactions.RemoveReactionAsync(postId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("reaction_state"); }
        });

        group.MapGet("/posts/{postId:guid}/reactions", async (Guid postId, string? type, string? cursor, int limit, [FromServices] ReactionService reactions, CancellationToken ct) =>
        {
            try { return Results.Ok(await reactions.ListReactorsAsync(postId, type, cursor, limit, ct)); }
            catch (Exception ex) { return ex.ToProblem(); }
        });
    }
}
