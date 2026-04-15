using BuildingBlocks.Auth;
using BuildingBlocks.Env;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Identity;
using BuildingBlocks.Messaging;
using Identity.Domain;
using Identity.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Identity.Features;

public sealed record AuthResult(Guid UserId, string DisplayName, string AccessToken, string RefreshToken, int ExpiresInMinutes);
public sealed record MeDto(Guid UserId, string DisplayName, string Email, string Status);
public sealed record RegisterRequest(string Email, string Password, string DisplayName, bool RememberMe = false);
public sealed record LoginRequest(string Email, string Password, bool RememberMe = false);
public sealed record RefreshRequest(string RefreshToken, bool RememberMe = false);

public class AuthService(
    IdentityDbContext db,
    NotificationClient notifications,
    IHttpContextAccessor http,
    ILogger<AuthService> logger)
{
    private static string HashToken(string token) =>
        Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));

    private async Task<AuthResult> IssueTokensAsync(User user, ClientInfo client, bool rememberMe, CancellationToken ct)
    {
        var (accessToken, _) = ConnectlyTokens.CreateAccessToken(user.Id, user.DisplayName, user.Email);
        var ttlDays = rememberMe
            ? ConnectlyEnv.GetInt("REMEMBER_REFRESH_TTL_DAYS", 90)
            : ConnectlyEnv.LoadJwtOptions().RefreshTokenTtlDays;
        var refreshToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(refreshToken),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(ttlDays),
            CreatedAt = DateTimeOffset.UtcNow,
            LastUsedAt = DateTimeOffset.UtcNow,
            DeviceId = client.DeviceId,
            DeviceLabel = client.DeviceLabel,
            UserAgent = client.UserAgent,
            IpAddress = client.IpAddress,
            Location = client.Location
        });
        await db.SaveChangesAsync(ct);
        return new AuthResult(user.Id, user.DisplayName, accessToken, refreshToken, ConnectlyEnv.LoadJwtOptions().AccessTokenTtlMinutes);
    }

    public const string Producer = "connectlyidentity";
    public const string WelcomeNotification = "welcome";
    public const string NewSignInNotification = "new_signin";

    public async Task<AuthResult> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length > 100)
            throw new ArgumentException("DisplayName is required (max 100 chars).");
        if (request.Password.Length < BuildingBlocks.Env.ConnectlyEnv.PasswordMinLength())
            throw new ArgumentException("Password must be at least 8 characters.");

        if (await db.Users.AnyAsync(u => u.Email == email, ct))
            throw new InvalidOperationException("Account already exists.");

        var user = new User
        {
            Email = email,
            DisplayName = request.DisplayName.Trim(),
            PasswordHash = PasswordHasher.Hash(request.Password),
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Users.Add(user);
        db.EnqueueEvent(EventTypes.Identity.UserRegistered, new UserRegisteredV1(user.Id, user.Email, user.DisplayName), Producer);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("User {UserId} registered", user.Id);

        var client = await ClientInfoFactory.FromAsync(http.HttpContext, ct);
        var result = await IssueTokensAsync(user, client, request.RememberMe, ct);
        await notifications.TryPushAsync(
            user.Id,
            WelcomeNotification,
            "Welcome to Connectly! Add a photo, a short bio and your city so people can find you.",
            ct: ct);
        return result;
    }

    public async Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !PasswordHasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid credentials.");
        if (user.Status != "active")
            throw new UnauthorizedAccessException("Account is not active.");

        var client = await ClientInfoFactory.FromAsync(http.HttpContext, ct);
        var knownDevice = client.DeviceId is { Length: > 0 } deviceId
            && await db.RefreshTokens.AnyAsync(t => t.UserId == user.Id && t.DeviceId == deviceId, ct);

        var result = await IssueTokensAsync(user, client, request.RememberMe, ct);
        if (!knownDevice)
        {
            var deviceLabel = client.DeviceLabel ?? "an unrecognised device";
            var where = string.IsNullOrWhiteSpace(client.Location) ? string.Empty : $" · {client.Location}";
            await notifications.TryPushAsync(
                user.Id,
                NewSignInNotification,
                $"New sign-in from {deviceLabel}{where}",
                deviceLabel: client.DeviceLabel,
                ipAddress: client.IpAddress,
                location: client.Location,
                ct: ct);
        }
        return result;
    }

    public async Task<AuthResult> RefreshAsync(RefreshRequest request, CancellationToken ct)
    {
        var hash = HashToken(request.RefreshToken);
        var stored = await db.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is null || stored.RevokedAt is not null || stored.ExpiresAt < DateTimeOffset.UtcNow)
            throw new UnauthorizedAccessException("Invalid or expired refresh token.");
        if (stored.User?.Status != "active")
            throw new UnauthorizedAccessException("Account is not active.");

        stored.RevokedAt = DateTimeOffset.UtcNow;
        var deviceId = http.HttpContext!.Request.Headers["X-Device-Id"].ToString();
        var deviceLabel = stored.DeviceLabel;
        var userAgent = stored.UserAgent;
        var ipAddress = stored.IpAddress;
        var location = stored.Location;
        if (!string.IsNullOrEmpty(deviceId)) { /* update device session */ }
        var ttlDays = request.RememberMe
            ? ConnectlyEnv.GetInt("REMEMBER_REFRESH_TTL_DAYS", 90)
            : ConnectlyEnv.LoadJwtOptions().RefreshTokenTtlDays;
        var refreshToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = stored.UserId,
            TokenHash = HashToken(refreshToken),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(ttlDays),
            CreatedAt = DateTimeOffset.UtcNow,
            LastUsedAt = DateTimeOffset.UtcNow,
            DeviceId = deviceId,
            DeviceLabel = deviceLabel,
            UserAgent = userAgent,
            IpAddress = ipAddress,
            Location = location
        });
        await db.SaveChangesAsync(ct);

        var (accessToken, _) = ConnectlyTokens.CreateAccessToken(stored.UserId, stored.User!.DisplayName, stored.User.Email);
        return new AuthResult(
            stored.UserId,
            stored.User.DisplayName,
            accessToken,
            refreshToken,
            ConnectlyEnv.LoadJwtOptions().AccessTokenTtlMinutes);
    }

    public async Task<MeDto> GetMeAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new KeyNotFoundException("User not found.");
        return new MeDto(user.Id, user.DisplayName, user.Email, user.Status);
    }
}
