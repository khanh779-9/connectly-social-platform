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

/// <summary>
/// One immutable revision of a post's text: who changed it, from what, to what and when.
/// The current text stays on <see cref="Post"/>; this table is the audit trail behind it.
/// </summary>
public class PostEdit
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PostId { get; set; }
    public Guid EditorUserId { get; set; }
    public string? PreviousText { get; set; }
    public string? NewText { get; set; }
    public DateTimeOffset EditedAt { get; set; }
}

/// <summary>Revision history for a comment, same shape as <see cref="PostEdit"/>.</summary>
public class CommentEdit
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CommentId { get; set; }
    public Guid EditorUserId { get; set; }
    public string? PreviousContent { get; set; }
    public string? NewContent { get; set; }
    public DateTimeOffset EditedAt { get; set; }
}

public class PostReaction
{
    public Guid PostId { get; set; }
    public Guid UserId { get; set; }
    public string ReactionType { get; set; } = "like";
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>
/// Facebook-style fixed reaction set (chapter: Reaction & Emoji Interaction Engine — SINGLE_SET mode).
/// Keys are stored lowercase; UI constants map them to emoji + labels.
/// </summary>
public static class ReactionSet
{
    public const string Like = "like";
    public const string Love = "love";
    public const string Care = "care";
    public const string Haha = "haha";
    public const string Wow = "wow";
    public const string Sad = "sad";
    public const string Angry = "angry";

    public static readonly string[] All = [Like, Love, Care, Haha, Wow, Sad, Angry];

    public static bool IsValid(string? type) =>
        type is not null && All.Contains(type.Trim().ToLowerInvariant());

    /// <summary>Turns a reaction sent by the client into one of the fixed values; unknown values become "like".</summary>
    public static string Normalize(string? type)
    {
        var value = (type ?? string.Empty).Trim().ToLowerInvariant();
        return IsValid(value) ? value : Like;
    }
}

/// <summary>Reaction on a comment — a distinct target from the post reaction (composite PK: comment_id + user_id).</summary>
public class CommentReaction
{
    public Guid CommentId { get; set; }
    public Guid UserId { get; set; }
    public string ReactionType { get; set; } = "like";
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Record that a user shared a post (one row per share event; not idempotent by design).</summary>
public class PostShare
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PostId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Normalized hashtag extracted from post text (composite PK: post_id + tag).</summary>
public class PostHashtag
{
    public Guid PostId { get; set; }
    public string Tag { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Saved post (composite PK: post_id + user_id).</summary>
public class PostBookmark
{
    public Guid PostId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

