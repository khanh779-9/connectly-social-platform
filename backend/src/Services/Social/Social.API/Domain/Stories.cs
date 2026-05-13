namespace Social.Domain;

/// <summary>A short-lived story (24h) attached to an uploaded media asset.</summary>
public class Story
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AuthorUserId { get; set; }
    public Guid MediaAssetId { get; set; }
    public string? Caption { get; set; }
    public PostVisibility Visibility { get; set; } = PostVisibility.Friends;
    public DateTimeOffset CreatedAt { get; set; }
    /// <summary>Null means the story was archived into a highlight and no longer shows in the story rail.</summary>
    public DateTimeOffset? ExpiresAt { get; set; }
}

public class StoryView
{
    public Guid StoryId { get; set; }
    public Guid ViewerUserId { get; set; }
    public DateTimeOffset ViewedAt { get; set; }
}

/// <summary>A permanent collection of stories shown on the profile (blueprint: StoryHighlights).</summary>
public class Highlight
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OwnerUserId { get; set; }
    public string Title { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; }
}

public class HighlightStory
{
    public Guid HighlightId { get; set; }
    public Guid StoryId { get; set; }
    public int SortOrder { get; set; }
}
