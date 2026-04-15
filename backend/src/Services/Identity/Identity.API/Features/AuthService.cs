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

