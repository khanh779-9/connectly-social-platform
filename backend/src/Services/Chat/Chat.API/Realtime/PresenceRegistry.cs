using System.Collections.Concurrent;

namespace Chat.Realtime;

/// <summary>
/// Which users currently hold at least one open hub socket. The hub writes to it and the
/// keep-alive service reads it, so the online flag stays true for as long as the app is open.
/// </summary>
public sealed class PresenceRegistry
{
    private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, byte>> _connections = new();

    /// <summary>True when this is the user's first live connection.</summary>
    public bool Attach(Guid userId, string connectionId)
    {
        var connections = _connections.GetOrAdd(userId, _ => new ConcurrentDictionary<string, byte>());
        var first = connections.IsEmpty;
        connections[connectionId] = 0;
        return first;
    }

    /// <summary>True when the user has no live connection left.</summary>
    public bool Detach(Guid userId, string connectionId)
    {
        if (!_connections.TryGetValue(userId, out var connections)) return true;
        connections.TryRemove(connectionId, out _);
        if (!connections.IsEmpty) return false;

        _connections.TryRemove(userId, out _);
        return true;
    }

    public IReadOnlyCollection<Guid> OnlineUsers() => _connections.Keys.ToArray();
}
