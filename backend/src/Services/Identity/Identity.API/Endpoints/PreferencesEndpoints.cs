using BuildingBlocks.Auth;
using BuildingBlocks.Exceptions;
using Identity.Features;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Identity.Endpoints;

/// <summary>Per-user settings (theme for now). Every route is scoped to the caller.</summary>
public static class PreferencesEndpoints
{
    public const string BasePath = "/api/v1/me/preferences";

    public static IEndpointRouteBuilder MapPreferencesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(BasePath).RequireAuthorization();

        group.MapGet("/", async ([FromServices] ICurrentUser currentUser, [FromServices] PreferencesService prefs, CancellationToken ct) =>
            Results.Ok(await prefs.GetAsync(currentUser.RequireUserId(), ct)));

        group.MapPut("/", async (
            [FromBody] UpdatePreferencesRequest request,
            [FromServices] ICurrentUser currentUser,
            [FromServices] PreferencesService prefs,
            CancellationToken ct) =>
        {
            try
            {
                return Results.Ok(await prefs.SaveAsync(currentUser.RequireUserId(), request, ct));
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = "invalid_preferences", message = ex.Message });
            }
        });

        return app;
    }
}
