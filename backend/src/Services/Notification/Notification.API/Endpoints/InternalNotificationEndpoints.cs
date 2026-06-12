using BuildingBlocks.Env;
using Microsoft.AspNetCore.Mvc;
using NotifSvc = NotificationService.Services.NotificationService;

namespace NotificationService.Endpoints;

public sealed record InternalNotificationRequest(
    Guid RecipientUserId,
    string Type,
    string? Preview,
    Guid? TargetPostId = null,
    Guid? TargetCommentId = null,
    string? DeviceLabel = null,
    string? IpAddress = null,
    string? Location = null);

/// <summary>
/// Service-to-service notifications (welcome, new sign-in). Not part of the public API:
/// the shared key must match, otherwise the request is rejected before touching the database.
/// </summary>
public static class InternalNotificationEndpoints
{
    public static IEndpointRouteBuilder MapInternalNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/internal/notifications", async (
            [FromBody] InternalNotificationRequest request,
            HttpContext http,
            [FromServices] NotifSvc notifications,
            CancellationToken ct) =>
        {
            var provided = http.Request.Headers["X-Internal-Key"].ToString();
            var expected = ConnectlyEnv.InternalApiKey();
            if (!string.Equals(provided, expected, StringComparison.Ordinal)) return Results.Unauthorized();
            if (request.RecipientUserId == Guid.Empty || string.IsNullOrWhiteSpace(request.Type)) return Results.BadRequest();

            await notifications.PushAsync(
                request.RecipientUserId,
                actorUserId: null,
                request.Type,
                targetPostId: request.TargetPostId,
                targetCommentId: request.TargetCommentId,
                preview: request.Preview,
                deviceLabel: request.DeviceLabel,
                ipAddress: request.IpAddress,
                location: request.Location,
                ct: ct);

            return Results.NoContent();
        });

        return app;
    }
}
