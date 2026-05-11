namespace Social.Domain;

/// <summary>A poll attached to a post (blueprint: Polls / PollOptions / PollVotes).</summary>
public class Poll
{
    public Guid PostId { get; set; }
    public string Question { get; set; } = default!;
    public bool AllowMultiple { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class PollOption
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PostId { get; set; }
    public string Text { get; set; } = default!;
    public int SortOrder { get; set; }
}

/// <summary>One row per (poll, option, user); a user may hold several rows only in multi-choice polls.</summary>
public class PollVote
{
    public Guid PostId { get; set; }
    public Guid OptionId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
