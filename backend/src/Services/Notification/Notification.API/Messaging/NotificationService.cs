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

