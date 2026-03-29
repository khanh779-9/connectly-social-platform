using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using BuildingBlocks.Env;
using Microsoft.IdentityModel.Tokens;

namespace BuildingBlocks.Auth;

/// <summary>Simple PBKDF2 (SHA-256) password hashing â€” adequate for dev, swap with ASP.NET Identity hasher for prod.</summary>
public static class PasswordHasher
{
    private static readonly int Iterations = ConnectlyEnv.PasswordHashIterations();
    private static readonly int SaltSize = ConnectlyEnv.PasswordHashSaltSizeBytes();
    private static readonly int KeySize = ConnectlyEnv.PasswordHashKeySizeBytes();

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, KeySize);
        return $"v1.{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(key)}";
    }

    public static bool Verify(string password, string stored)
    {
        var parts = stored.Split('.');
        if (parts.Length != 4 || parts[0] != "v1") return false;
        var salt = Convert.FromBase64String(parts[2]);
        var expected = Convert.FromBase64String(parts[3]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, int.Parse(parts[1]), HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}

/// <summary>Access token writer used by Identity Service; other services validate with the same options.</summary>
public static class ConnectlyTokens
{
    public static (string token, DateTimeOffset expiresAt) CreateAccessToken(
        Guid userId, string displayName, string? email = null, JwtOptions? options = null)
    {
        var jwt = options ?? ConnectlyEnv.LoadJwtOptions();
        var now = DateTimeOffset.UtcNow;
        var handler = new JwtSecurityTokenHandler();

