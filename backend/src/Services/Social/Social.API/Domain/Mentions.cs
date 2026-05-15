namespace Social.Domain;

/// <summary>User tagged in a post body (composite PK: post_id + user_id).</summary>
public class PostMention
{
    public Guid PostId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>User tagged in a comment body (composite PK: comment_id + user_id).</summary>
public class CommentMention
{
    public Guid CommentId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
