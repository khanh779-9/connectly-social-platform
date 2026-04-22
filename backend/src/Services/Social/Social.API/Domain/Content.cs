namespace Social.Domain;

public enum PostVisibility
{
    Public = 0,
    Friends = 1,
    OnlyMe = 2
}

public enum PostStatus
{
    Draft = 0,
    Published = 1,
    Hidden = 2,
    Deleted = 3
}

public class Post
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AuthorUserId { get; set; }
    public string? TextContent { get; set; }
    /// <summary>Set when the post lives inside a group; visibility is then governed by the group.</summary>
    public Guid? GroupId { get; set; }
    /// <summary>Set when the post is published on behalf of a page.</summary>
    public Guid? PageId { get; set; }
    public PostVisibility Visibility { get; set; } = PostVisibility.Public;
    public PostStatus Status { get; set; } = PostStatus.Draft;
    /// <summary>True when the post is a vertical short-form video (Reel).</summary>
    public bool IsReel { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset? EditedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }

    public ICollection<PostMedia> Media { get; set; } = new List<PostMedia>();
}

/// <summary>Reference to [stora] object; no FK across services.</summary>
public class PostMedia
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PostId { get; set; }
    public string ObjectKey { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long SizeBytes { get; set; }
    public int SortOrder { get; set; }
    public Post? Post { get; set; }
}

/// <summary>Uploaded media awaiting attachment (created by upload flow before post references it).</summary>
public class MediaAsset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OwnerUserId { get; set; }
    public string ObjectKey { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long SizeBytes { get; set; }
    /// <summary>avatar | cover | images | videos | stories | post</summary>
    public string Kind { get; set; } = default!;
    /// <summary>pending-upload | ready</summary>
    public string Status { get; set; } = "pending-upload";
    public DateTimeOffset CreatedAt { get; set; }
}

public class Comment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PostId { get; set; }
    public Guid AuthorUserId { get; set; }
    public Guid? ParentCommentId { get; set; }
    public string Content { get; set; } = default!;
    /// <summary>active | deleted</summary>
    public string Status { get; set; } = "active";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Post? Post { get; set; }
}

