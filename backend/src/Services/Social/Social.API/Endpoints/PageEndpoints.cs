using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Domain;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The pages and the people who may publish on them.</summary>
public static class PageEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapPost("/pages", async ([FromBody] CreatePageRequest request, [FromServices] PageService pages, CancellationToken ct) =>
        {
            try { return Results.Ok(await pages.CreatePageAsync(request, ct)); }
            catch (Exception ex) { return ex.ToProblem("page_state"); }
        });

        group.MapGet("/pages", async (string? cursor, int limit, [FromServices] PageService pages, CancellationToken ct) =>
            Results.Ok(await pages.ListPagesAsync(cursor, limit, ct)));

        group.MapGet("/pages/mine", async ([FromServices] PageService pages, CancellationToken ct) =>
            Results.Ok(await pages.ListMyPagesAsync(ct)));

        group.MapGet("/pages/{pageId:guid}", async (Guid pageId, [FromServices] PageService pages, CancellationToken ct) =>
        {
            try { return Results.Ok(await pages.GetPageAsync(pageId, ct)); }
            catch (Exception ex) { return ex.ToProblem("page_state"); }
        });

        group.MapPatch("/pages/{pageId:guid}", async (Guid pageId, [FromBody] UpdatePageRequest request, [FromServices] PageService pages, CancellationToken ct) =>
        {
            try { return Results.Ok(await pages.UpdatePageAsync(pageId, request, ct)); }
            catch (Exception ex) { return ex.ToProblem("page_state"); }
        });

        group.MapDelete("/pages/{pageId:guid}", async (Guid pageId, [FromServices] PageService pages, CancellationToken ct) =>
        {
            try { await pages.DeletePageAsync(pageId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("page_state"); }
        });

        group.MapGet("/pages/{pageId:guid}/admins", async (Guid pageId, [FromServices] PageService pages, CancellationToken ct) =>
        {
            try { return Results.Ok(await pages.ListAdminsAsync(pageId, ct)); }
            catch (Exception ex) { return ex.ToProblem("page_state"); }
        });

        group.MapPost("/pages/{pageId:guid}/admins/{userId:guid}", async (Guid pageId, Guid userId, string? role, [FromServices] PageService pages, CancellationToken ct) =>
        {
            try
            {
                var parsed = Enum.TryParse<PageAdminRole>(role, ignoreCase: true, out var value) ? value : PageAdminRole.Admin;
                return Results.Ok(await pages.AddAdminAsync(pageId, userId, parsed, ct));
            }
            catch (Exception ex) { return ex.ToProblem("page_state"); }
        });

        group.MapDelete("/pages/{pageId:guid}/admins/{userId:guid}", async (Guid pageId, Guid userId, [FromServices] PageService pages, CancellationToken ct) =>
        {
            try { await pages.RemoveAdminAsync(pageId, userId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("page_state"); }
        });
    }
}
