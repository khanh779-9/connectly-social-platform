using NotificationService.Persistence;
using BuildingBlocks.Auth;
using Microsoft.EntityFrameworkCore;

namespace NotificationService.Features;

public sealed record NotificationDto(
    Guid Id,
    string Type,
    Guid? ActorUserId,
    Guid? TargetPostId,
    Guid? TargetCommentId,
    string? Preview,
    string? DeviceLabel,
    string? IpAddress,
    string? Location,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReadAt);

public class NotificationQueryService(NotificationDbContext db, ICurrentUser currentUser)
{
    public async Task<List<NotificationDto>> ListAsync(string? status, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 50);
        var me = currentUser.RequireUserId();
        var query = db.Notifications.AsNoTracking().Where(n => n.RecipientUserId == me);
        if (!string.IsNullOrEmpty(status)) query = query.Where(n => n.Status == status);
        var items = await query.OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id).Take(limit).ToListAsync(ct);
        return items.Select(n => new NotificationDto(
            n.Id,
            n.Type,
            n.ActorUserId,
            n.TargetPostId,
            n.TargetCommentId,
            n.Preview,
            n.DeviceLabel,
            n.IpAddress,
            n.Location,
            n.Status,
            n.CreatedAt,
            n.ReadAt)).ToList();
    }

    public async Task<int> CountUnreadAsync(CancellationToken ct)
    {
        var me = currentUser.RequireUserId();
        return await db.Notifications.AsNoTracking()
            .CountAsync(n => n.RecipientUserId == me && n.Status == "unread", ct);
    }

    public async Task MarkReadAsync(Guid notificationId, CancellationToken ct)
    {
        var notification = await db.Notifications.SingleOrDefaultAsync(
            n => n.Id == notificationId && n.RecipientUserId == currentUser.RequireUserId(), ct)
            ?? throw new KeyNotFoundException();
        notification.Status = "read";
        notification.ReadAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task MarkAllReadAsync(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        await db.Notifications
            .Where(n => n.RecipientUserId == currentUser.RequireUserId() && n.Status == "unread")
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.Status, "read").SetProperty(n => n.ReadAt, now), ct);
    }
}
