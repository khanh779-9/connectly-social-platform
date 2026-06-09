using BuildingBlocks.Messaging.Consuming;
using NotificationService.Domain;
using NotificationEntity = NotificationService.Domain.Notification;
using NotificationService.Persistence;
using NotificationService.Realtime;
using Microsoft.AspNetCore.SignalR;

namespace NotificationService.Services;

/// <summary>
/// Creates the inbox notification (in the same transaction as the idempotency marker)
/// and pushes over SignalR. Handlers register themselves with the destination user.
/// </summary>
public class NotificationService(NotificationDbContext db, IHubContext<NotificationHub> hub)
{
    public async Task PushAsync(
        Guid recipientUserId, Guid? actorUserId, string type,
        Guid? targetPostId = null, Guid? targetCommentId = null, string? preview = null,
        string? deviceLabel = null, string? ipAddress = null, string? location = null,
        CancellationToken ct = default)
    {
        if (actorUserId == recipientUserId) return; // no self-notifications

        var notification = new NotificationEntity
        {
            RecipientUserId = recipientUserId,
            ActorUserId = actorUserId == recipientUserId ? null : actorUserId,
            Type = type,
            TargetPostId = targetPostId,
            TargetCommentId = targetCommentId,
            Preview = preview,
            DeviceLabel = deviceLabel,
            IpAddress = ipAddress,
            Location = location,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);

        await hub.Clients.Group($"user:{recipientUserId}").SendAsync("notification-received", new
        {
            id = notification.Id,
            type = notification.Type,
            actorUserId = notification.ActorUserId,
            targetPostId = notification.TargetPostId,
            targetCommentId = notification.TargetCommentId,
            preview = notification.Preview,
            deviceLabel = notification.DeviceLabel,
            ipAddress = notification.IpAddress,
            location = notification.Location,
            createdAt = notification.CreatedAt
        }, ct);
    }
}


