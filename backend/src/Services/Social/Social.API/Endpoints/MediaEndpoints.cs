using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The two-step upload of a file: ask for a ticket, upload, mark it ready.</summary>
public static class MediaEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapPost("/media/uploads", async ([FromBody] CreateUploadRequest request, [FromServices] MediaService media, CancellationToken ct) =>
        {
            try { return Results.Ok(await media.CreateUploadTicketAsync(request, ct)); }
            catch (Exception ex) { return ex.ToProblem(); }
        });

        // Fallback for providers that cannot take a browser upload: the client
        // posts the bytes here and the service writes them to storage.
        group.MapPost("/media/uploads/{mediaId:guid}/content", async (Guid mediaId, HttpRequest http, [FromServices] MediaService media, CancellationToken ct) =>
        {
            try
            {
                await media.UploadContentAsync(mediaId, http.Body, ct);
                return Results.NoContent();
            }
            catch (Exception ex) { return ex.ToProblem(); }
        });

        group.MapPost("/media/uploads/{mediaId:guid}/complete", async (Guid mediaId, [FromServices] MediaService media, CancellationToken ct) =>
        {
            try { return Results.Ok(new { objectUrl = await media.CompleteUploadAsync(mediaId, ct) }); }
            catch (Exception ex) { return ex.ToProblem(); }
        });
    }
}
