using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The comments of a post and the reactions on them.</summary>
public static class CommentEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapPost("/posts/{postId:guid}/comments", async (Guid postId, [FromBody] CreateCommentRequest request, [FromServices] CommentService comments, CancellationToken ct) =>
        {
            try { return Results.Ok(await comments.CreateCommentAsync(postId, request, ct)); }
            catch (Exception ex) { return ex.ToProblem("comment_state"); }
        });

        group.MapGet("/posts/{postId:guid}/comments", async (Guid postId, string? cursor, int limit, [FromServices] CommentService comments, CancellationToken ct) =>
        {
            try { return Results.Ok(await comments.ListCommentsAsync(postId, cursor, limit, ct)); }
            catch (Exception ex) { return ex.ToProblem("post_state"); }
        });

        group.MapPatch("/comments/{commentId:guid}", async (Guid commentId, [FromBody] UpdateCommentRequest request, [FromServices] CommentService comments, CancellationToken ct) =>
        {
            try { return Results.Ok(await comments.EditCommentAsync(commentId, request, ct)); }
            catch (Exception ex) { return ex.ToProblem("comment_state"); }
        });

        group.MapDelete("/comments/{commentId:guid}", async (Guid commentId, [FromServices] CommentService comments, CancellationToken ct) =>
        {
            try { await comments.DeleteCommentAsync(commentId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("comment_state"); }
        });

        group.MapPut("/comments/{commentId:guid}/reaction", async (Guid commentId, [FromBody] SetCommentReactionRequest request, [FromServices] CommentService comments, CancellationToken ct) =>
        {
            try { await comments.SetCommentReactionAsync(commentId, request, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("reaction_state"); }
        });

        group.MapDelete("/comments/{commentId:guid}/reaction", async (Guid commentId, [FromServices] CommentService comments, CancellationToken ct) =>
        {
            try { await comments.RemoveCommentReactionAsync(commentId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("reaction_state"); }
        });

        // the revision history is readable by anyone who can read the comment
        group.MapGet("/comments/{commentId:guid}/edits", async (Guid commentId, [FromServices] CommentService comments, CancellationToken ct) =>
        {
            var history = await comments.GetCommentEditHistoryAsync(commentId, ct);
            return history is null ? Results.NotFound() : Results.Ok(history);
        });
    }
}
