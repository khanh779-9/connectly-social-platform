using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace NotificationService.Realtime;

/// <summary>Authenticated in-app realtime notifications. Server event: notification-received.</summary>
[Authorize]
public class NotificationHub : Hub
{
    public const string Path = "/hubs/notifications";

    public sealed record NotificationPayload(
        Guid Id,
        string Type,
        Guid? ActorUserId,
        Guid? TargetPostId,
        Guid? TargetCommentId,
        string? Preview,
        string? DeviceLabel,
        string? IpAddress,
        string? Location,
        DateTimeOffset CreatedAt);

    private Guid UserId =>
        Context.User?.FindFirst("sub") is { } claim && Guid.TryParse(claim.Value, out var id) ? id : default;

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
        if (UserId == Guid.Empty) Context.Abort();
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{UserId}");
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (UserId != Guid.Empty)
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user:{UserId}");
        await base.OnDisconnectedAsync(exception);
    }
}


