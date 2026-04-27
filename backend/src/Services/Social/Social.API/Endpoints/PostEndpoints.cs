using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The posts themselves: writing, editing, sharing and bookmarking them.</summary>
public static class PostEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapPost("/posts", async ([FromBody] CreatePostRequest request, [FromServices] PostService posts, CancellationToken ct) =>
        {
            try { return Results.Ok(await posts.CreatePostAsync(request, ct)); }
            catch (Exception ex) { return ex.ToProblem(); }
        });

        group.MapGet("/posts/{postId:guid}", async (Guid postId, [FromServices] PostService posts, CancellationToken ct) =>
        {
            var post = await posts.GetPostAsync(postId, ct);
            return post is null ? Results.NotFound() : Results.Ok(post);
        });

        group.MapPatch("/posts/{postId:guid}", async (Guid postId, [FromBody] UpdatePostRequest request, [FromServices] PostService posts, CancellationToken ct) =>
        {
            try { return Results.Ok(await posts.UpdatePostAsync(postId, request, ct)); }
            catch (Exception ex) { return ex.ToProblem("post_state"); }
        });

        group.MapDelete("/posts/{postId:guid}", async (Guid postId, [FromServices] PostService posts, CancellationToken ct) =>
        {
            try { await posts.DeletePostAsync(postId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("post_state"); }
        });

