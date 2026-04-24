using Social.Domain;

namespace Social.Features;

// ---------- Posts ----------

public sealed record CreatePostRequest(
    string? TextContent,
    PostVisibility Visibility,
    List<Guid> MediaAssetIds,
    bool PublishImmediately,
    Guid? GroupId = null,
    PollInput? Poll = null,
    Guid? PageId = null);

public sealed record UpdatePostRequest(string? TextContent, PostVisibility? Visibility);

public sealed record PostDto(
    Guid Id,
    Guid AuthorUserId,
    string? TextContent,
    string Visibility,
    string Status,
    DateTimeOffset CreatedAt,
    List<PostMediaDto> Media,
    int ReactionCount = 0,
    int CommentCount = 0,
    string? ViewerReaction = null,
    bool ViewerBookmarked = false,
    List<ReactionBreakdownDto>? ReactionBreakdowns = null,
    int ShareCount = 0,
    Guid? GroupId = null,
    PollDto? Poll = null,
    Guid? PageId = null,
    List<MentionDto>? Mentions = null,
    DateTimeOffset? EditedAt = null);

public sealed record PostMediaDto(Guid Id, string ObjectKey, string Url, string ContentType, int SortOrder);

public sealed record ReactionBreakdownDto(string Type, int Count);

public sealed record FeedItemDto(PostDto Post, string Source);

/// <summary>A user tagged with @username inside a post or a comment.</summary>
public sealed record MentionDto(Guid UserId, string Username);

/// <summary>One revision: who edited, the text before/after, and when.</summary>
public sealed record ContentEditDto(Guid EditorUserId, string? PreviousText, string? NewText, DateTimeOffset EditedAt);

/// <summary>Every kind of result the search page shows, in one response.</summary>
public sealed record SearchResultDto(
    List<ProfileDto> Users,
    List<PostDto> Posts,
    List<GroupDto> Groups,
    List<PageDto> Pages,
    List<EventDto> Events,
    List<string> Hashtags);

// ---------- Comments ----------

public sealed record CreateCommentRequest(string Content, Guid? ParentCommentId);

public sealed record UpdateCommentRequest(string Content);

public sealed record CommentDto(
    Guid Id,
    Guid PostId,
    Guid AuthorUserId,
    Guid? ParentCommentId,
    string Content,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    bool WasEdited,
    int ReactionCount = 0,
    string? ViewerReaction = null,
    List<MentionDto>? Mentions = null);

public sealed record SetCommentReactionRequest(string ReactionType);

// ---------- Reactions ----------

public sealed record SetReactionRequest(string ReactionType);

public sealed record ReactionActorDto(Guid UserId, string ReactionType, DateTimeOffset CreatedAt);

// ---------- Polls ----------

public sealed record PollInput(string Question, List<string> Options, bool AllowMultiple = false);

public sealed record PollVoteRequest(List<Guid> OptionIds);

public sealed record PollOptionDto(Guid Id, string Text, int VoteCount, bool ViewerVoted);

public sealed record PollDto(Guid PostId, string Question, bool AllowMultiple, List<PollOptionDto> Options, int TotalVotes);
