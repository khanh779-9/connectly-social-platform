using System.Globalization;

namespace Chat.Realtime;

/// <summary>Online right now, plus when the user was last seen (for "Active 3h ago").</summary>
public sealed record PresenceSnapshot(bool Online, DateTimeOffset? LastSeenAt);

/// <summary>
/// Presence, kept in Redis (distributed coordination across replicas).
/// Keys: connectly:pres:{userId} -> "online" TTL 90s (refreshed while a socket is open)
///       connectly:pres:seen:{userId} -> ISO timestamp of the last heartbeat, kept for weeks.
/// </summary>
public class PresenceService(StackExchange.Redis.IConnectionMultiplexer redis)
{
    private const string PresPrefix = "connectly:pres:";
    private const string SeenPrefix = "connectly:pres:seen:";
    private static readonly TimeSpan OnlineTtl = BuildingBlocks.Env.ConnectlyEnv.PresenceOnlineTtl();
    private static readonly TimeSpan SeenTtl = BuildingBlocks.Env.ConnectlyEnv.PresenceSeenTtl();

    public async Task HeartbeatAsync(Guid userId, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        var batch = db.CreateBatch();
        var online = batch.StringSetAsync(PresPrefix + userId, "online", OnlineTtl);
        var seen = batch.StringSetAsync(SeenPrefix + userId, DateTimeOffset.UtcNow.ToString("O"), SeenTtl);
        batch.Execute();
        await Task.WhenAll(online, seen);
    }

    /// <summary>Drops the online flag but keeps the moment the user was last active.</summary>
    public async Task MarkOfflineAsync(Guid userId, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        var batch = db.CreateBatch();
        var online = batch.KeyDeleteAsync(PresPrefix + userId);
        var seen = batch.StringSetAsync(SeenPrefix + userId, DateTimeOffset.UtcNow.ToString("O"), SeenTtl);
        batch.Execute();
        await Task.WhenAll(online, seen);
    }

    public async Task<bool> IsOnlineAsync(Guid userId, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        return await db.KeyExistsAsync(PresPrefix + userId);
    }

    public async Task<Dictionary<Guid, bool>> AreOnlineAsync(IEnumerable<Guid> userIds, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        var ids = userIds.Distinct().ToArray();

        // pipeline all exists-checks in one round-trip instead of one call per user
        var batch = db.CreateBatch();
        var tasks = ids.Select(id => batch.KeyExistsAsync(PresPrefix + id)).ToArray();
        batch.Execute();
        var results = await Task.WhenAll(tasks);

        return Enumerable.Range(0, ids.Length).ToDictionary(i => ids[i], i => results[i]);
    }

    /// <summary>Online flag and last-seen timestamp for a batch of users, in one round-trip.</summary>
    public async Task<Dictionary<Guid, PresenceSnapshot>> GetSnapshotsAsync(
        IEnumerable<Guid> userIds, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        var ids = userIds.Distinct().ToArray();
        if (ids.Length == 0) return new Dictionary<Guid, PresenceSnapshot>();

        var batch = db.CreateBatch();
        var onlineTasks = ids.Select(id => batch.KeyExistsAsync(PresPrefix + id)).ToArray();
        var seenTasks = ids.Select(id => batch.StringGetAsync(SeenPrefix + id)).ToArray();
        batch.Execute();

        await Task.WhenAll(onlineTasks);
        await Task.WhenAll(seenTasks);

        var snapshots = new Dictionary<Guid, PresenceSnapshot>(ids.Length);
        for (var i = 0; i < ids.Length; i++)
        {
            DateTimeOffset? lastSeen = DateTimeOffset.TryParse(
                seenTasks[i].Result.ToString(), CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind, out var parsed)
                ? parsed
                : null;
            snapshots[ids[i]] = new PresenceSnapshot(onlineTasks[i].Result, lastSeen);
        }

        return snapshots;
    }
}

