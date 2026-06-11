using NotificationService.Features;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace NotificationService.Endpoints;

public static class NotificationEndpoints
{
    public const string BasePath = "/api/v1";

    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(BasePath).RequireAuthorization();

        group.MapGet("/notifications", async (
            string? status,
            int limit,
            [FromServices] NotificationQueryService service,
            CancellationToken ct) =>
            Results.Ok(await service.ListAsync(status, limit, ct)));

        group.MapGet("/notifications/unread-count", async ([FromServices] NotificationQueryService service, CancellationToken ct) =>
            Results.Ok(new { count = await service.CountUnreadAsync(ct) }));

        group.MapPost("/notifications/{notificationId:guid}/read", async (
            Guid notificationId,
            [FromServices] NotificationQueryService service,
            CancellationToken ct) =>
        {
            await service.MarkReadAsync(notificationId, ct);
            return Results.NoContent();
        });

        group.MapPost("/notifications/read-all", async ([FromServices] NotificationQueryService service, CancellationToken ct) =>
        {
            await service.MarkAllReadAsync(ct);
            return Results.NoContent();
        });

        return app;
    }
}
