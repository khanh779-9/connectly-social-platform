using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BuildingBlocks.Env;

namespace Identity.Features;

/// <summary>Who is signing in: the browser's device id plus what the request reveals about it.</summary>
public sealed record ClientInfo(
    string? DeviceId,
    string? DeviceLabel,
    string? UserAgent,
    string? IpAddress,
    string? Location);

/// <summary>
/// Reads the device id / user agent / client address from the current request.
/// Location is coarse on purpose: private ranges never leave the machine and a lookup
/// failure is reported as "Unknown" instead of blocking the sign-in.
/// </summary>
public static class ClientInfoFactory
{
    private static readonly HttpClient Geo = new() { Timeout = ConnectlyEnv.GeoIpTimeout() };
    private static readonly ConcurrentDictionary<string, string> LocationCache = new();

    public static async Task<ClientInfo> FromAsync(HttpContext? http, CancellationToken ct)
    {
        if (http is null) return new ClientInfo(null, null, null, null, null);

        var deviceId = http.Request.Headers["X-Device-Id"].ToString();
        var userAgent = http.Request.Headers.UserAgent.ToString();
        var ip = ResolveIp(http);
        var location = await ResolveLocationAsync(ip, ct);

        return new ClientInfo(
            string.IsNullOrWhiteSpace(deviceId) ? null : Truncate(deviceId, 64),
            LabelFrom(userAgent),
            string.IsNullOrWhiteSpace(userAgent) ? null : Truncate(userAgent, 400),
            ip,
            location);
    }

    /// <summary>Maps the raw user agent to a short label the account owner recognises.</summary>
    public static string? LabelFrom(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent)) return "Unknown device";

        var browser = userAgent.Contains("Edg/") ? "Edge"
            : userAgent.Contains("OPR/") || userAgent.Contains("Opera") ? "Opera"
            : userAgent.Contains("Firefox/") ? "Firefox"
            : userAgent.Contains("Chrome/") || userAgent.Contains("Chromium/") ? "Chrome"
            : userAgent.Contains("Safari/") ? "Safari"
            : null;

        var os = userAgent.Contains("Windows") ? "Windows"
            : userAgent.Contains("Android") ? "Android"
            : userAgent.Contains("iPhone") || userAgent.Contains("iPad") ? "iOS"
            : userAgent.Contains("Mac OS X") || userAgent.Contains("Macintosh") ? "macOS"
            : userAgent.Contains("Linux") ? "Linux"
            : null;

        if (browser is null && os is null) return Truncate(userAgent, 60);
        if (browser is null) return os;
        if (os is null) return browser;
        return $"{browser} on {os}";
    }

    private static string? ResolveIp(HttpContext http)
    {
        // The gateway forwards the caller address; fall back to the socket address locally.
        var forwarded = http.Request.Headers["X-Forwarded-For"].ToString();
        var candidate = forwarded
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault() ?? http.Connection.RemoteIpAddress?.ToString();

        if (string.IsNullOrWhiteSpace(candidate)) return null;
        if (candidate.StartsWith("::ffff:", StringComparison.OrdinalIgnoreCase)) candidate = candidate[7..];
        if (candidate == "::1") candidate = "127.0.0.1";
        return Truncate(candidate, 64);
    }

    private static bool IsLocal(string ip) =>
        ip == "127.0.0.1" || ip == "localhost" || ip.StartsWith("10.") || ip.StartsWith("192.168.")
        || ip.StartsWith("172.16.") || ip.StartsWith("172.17.") || ip.StartsWith("172.18.") || ip.StartsWith("172.19.")
        || ip.StartsWith("172.2") || ip.StartsWith("172.30.") || ip.StartsWith("172.31.") || ip.StartsWith("169.254.")
        || ip.StartsWith("fc") || ip.StartsWith("fd") || ip.StartsWith("fe80");

    private static async Task<string?> ResolveLocationAsync(string? ip, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(ip)) return null;
        if (IsLocal(ip) || !IPAddress.TryParse(ip, out _)) return "Local network";
        if (LocationCache.TryGetValue(ip, out var cached)) return cached;

        try
        {
            using var response = await Geo.GetAsync($"{ConnectlyEnv.GeoIpApiBase()}/{ip}/json/", ct);
            if (!response.IsSuccessStatusCode) return Cache(ip, "Unknown");

            var body = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            var city = body.TryGetProperty("city", out var c) && c.ValueKind == JsonValueKind.String ? c.GetString() : null;
            var country = body.TryGetProperty("country_name", out var n) && n.ValueKind == JsonValueKind.String ? n.GetString() : null;
            var label = string.Join(", ", new[] { city, country }.Where(part => !string.IsNullOrWhiteSpace(part)));
            return Cache(ip, string.IsNullOrWhiteSpace(label) ? "Unknown" : Truncate(label, 160)!);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or OperationCanceledException)
        {
            // No internet or the lookup timed out: the session is still recorded, without a place.
            return Cache(ip, "Unknown");
        }
    }

    private static string Cache(string ip, string value)
    {
        LocationCache[ip] = value;
        return value;
    }

    private static string? Truncate(string? value, int max) =>
        value is null ? null : value.Length <= max ? value : value[..max];
}
