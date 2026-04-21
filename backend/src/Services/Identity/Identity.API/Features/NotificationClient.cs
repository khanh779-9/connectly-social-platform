using BuildingBlocks.Env;
using System.Net.Http.Json;

namespace Identity.Features;

/// <summary>
/// Posts a system notification to the notification service. Sign-in alerts and the
/// welcome message must never break authentication, so every failure is logged and swallowed.
/// </summary>
public sealed class NotificationClient(HttpClient http, ILogger<NotificationClient> logger)
{
    public async Task TryPushAsync(
        Guid recipientUserId,
        string type,
        string? preview,
        string? deviceLabel = null,
        string? ipAddress = null,
        string? location = null,
        CancellationToken ct = default)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "internal/notifications")
            {
                Content = JsonContent.Create(new
                {
                    recipientUserId,
                    type,
                    preview,
                    deviceLabel,
                    ipAddress,
                    location
                })
            };
            request.Headers.TryAddWithoutValidation("X-Internal-Key", InternalKey());

            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Notification push ({Type}) returned {Status}", type, (int)response.StatusCode);
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "Notification push ({Type}) failed; the sign-in continues.", type);
        }
    }

    public static string BaseAddress() => ConnectlyEnv.NotificationApiBase();

    public static string InternalKey() => ConnectlyEnv.InternalApiKey();
}
