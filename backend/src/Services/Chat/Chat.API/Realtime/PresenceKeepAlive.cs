namespace Chat.Realtime;

/// <summary>
/// The online key expires after 90 seconds so a dropped socket eventually reads as offline.
/// This loop refreshes it for every user with a live connection, which is what makes
/// "Active now" truthful while the app stays open without sending anything.
/// </summary>
public sealed class PresenceKeepAlive(
    PresenceRegistry registry,
    PresenceService presence,
    ILogger<PresenceKeepAlive> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = BuildingBlocks.Env.ConnectlyEnv.PresenceKeepAliveInterval();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            foreach (var userId in registry.OnlineUsers())
            {
                try
                {
                    await presence.HeartbeatAsync(userId, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
                catch (Exception ex)
                {
                    // Redis hiccups only cost accuracy; the loop keeps running.
                    logger.LogDebug(ex, "Presence heartbeat failed for {UserId}", userId);
                }
            }
        }
    }
}
