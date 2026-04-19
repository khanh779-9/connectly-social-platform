using BuildingBlocks.Auth;
using BuildingBlocks.Dto;
using BuildingBlocks.Exceptions;
using Identity.Features;
using Microsoft.AspNetCore.Mvc;

namespace Identity.Endpoints;

public sealed record RevokeSessionsRequest(IReadOnlyCollection<Guid> Ids);

/// <summary>Security section: the devices currently signed in and how to end them.</summary>
public static class SecurityEndpoints
{
    public const string BasePath = "/api/v1";

    public static IEndpointRouteBuilder MapSecurityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(BasePath).RequireAuthorization();

        group.MapGet("/security/sessions", async (
            HttpContext http,
            [FromServices] ICurrentUser currentUser,
            [FromServices] SessionService sessions,
            CancellationToken ct) =>
        {
            var deviceId = http.Request.Headers["X-Device-Id"].ToString();
            try { return Results.Ok(await sessions.ListAsync(currentUser.RequireUserId(), deviceId, ct)); }
            catch (Exception ex) { return ex.ToProblem("sessions"); }
        });

        group.MapPost("/security/sessions/revoke", async (
            [FromBody] RevokeSessionsRequest request,
            [FromServices] ICurrentUser currentUser,
            [FromServices] SessionService sessions,
            CancellationToken ct) =>
        {
            try
            {
                var revoked = await sessions.RevokeAsync(currentUser.RequireUserId(), request.Ids ?? [], ct);
                return Results.Ok(new { revoked });
            }
            catch (Exception ex) { return ex.ToProblem("sessions"); }
        });

        return app;
    }
}
