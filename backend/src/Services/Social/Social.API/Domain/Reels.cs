namespace Social.Domain;

/// <summary>
/// A qualified view of a reel. The blueprint keeps "view" and "watch time"
/// apart: one row per playback session, the accumulated watch time lives in
/// <see cref="WatchedMs"/>.
/// </summary>
public class ReelView
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PostId { get; set; }
    public Guid ViewerUserId { get; set; }
    /// <summary>Milliseconds actually watched during this session.</summary>
    public int WatchedMs { get; set; }
    public DateTimeOffset ViewedAt { get; set; }
}
