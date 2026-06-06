namespace NotificationService.Domain;

public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RecipientUserId { get; set; }
    /// <summary>
    /// friend_request | friend_accepted | followed | comment | reaction | shared |
    /// group_request | group_member | poll_vote | story_view | mention | welcome | new_signin
    /// </summary>
    public string Type { get; set; } = default!;
    /// <summary>actor who triggered the notification (nullable for system).</summary>
    public Guid? ActorUserId { get; set; }
    public Guid? TargetPostId { get; set; }
    public Guid? TargetCommentId { get; set; }
    public string? Preview { get; set; }
    /// <summary>Short device description for a new sign-in, for example "Chrome on Windows".</summary>
    public string? DeviceLabel { get; set; }
    /// <summary>IP address observed when a new sign-in was created.</summary>
    public string? IpAddress { get; set; }
    /// <summary>Coarse location observed when a new sign-in was created.</summary>
    public string? Location { get; set; }
    /// <summary>unread | read</summary>
    public string Status { get; set; } = "unread";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
}

