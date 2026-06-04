using System.Net.Http.Json;
using System.Text.Json;
using BuildingBlocks.Env;

namespace Chat.Features;

/// <summary>
/// Asks the Social service how two users relate. The caller's bearer token is forwarded, so
/// Social answers for the same user and no chat-specific credentials are needed.
/// Returns null when the lookup could not be made (Social down) — callers decide the fallback.
/// </summary>
public sealed class SocialRelationshipClient(HttpClient http, IHttpContextAccessor accessor, ILogger<SocialRelationshipClient> logger)
{
    public async Task<bool?> IsFriendAsync(Guid otherUserId, CancellationToken ct)
    {
        var authorization = accessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authorization)) return null;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"users/{otherUserId}/relationship");
            request.Headers.TryAddWithoutValidation("Authorization", authorization);
            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Relationship lookup for {UserId} returned {Status}", otherUserId, (int)response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            return body.TryGetProperty("isFriend", out var isFriend) && isFriend.ValueKind == JsonValueKind.True;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogWarning(ex, "Relationship lookup for {UserId} failed", otherUserId);
            return null;
        }
    }

    public static string BaseAddress() => ConnectlyEnv.SocialApiBase();
}
