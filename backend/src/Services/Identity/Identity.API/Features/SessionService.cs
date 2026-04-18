using Identity.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Identity.Features;

/// <summary>One sign-in as the account owner sees it on the security page.</summary>
public sealed record SessionDto(
    Guid Id,
    string? DeviceLabel,
    string? UserAgent,
    string? IpAddress,
    string? Location,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastUsedAt,
    bool Current);

/// <summary>A session is a live refresh token; revoking it ends that device's sign-in.</summary>
public class SessionService(IdentityDbContext db)
{
    public async Task<List<SessionDto>> ListAsync(Guid userId, string? currentDeviceId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var rows = await db.RefreshTokens.AsNoTracking()
            .Where(t => t.UserId == userId && t.RevokedAt == null && t.ExpiresAt > now)
            .OrderByDescending(t => t.LastUsedAt ?? t.CreatedAt)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

