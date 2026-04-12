namespace Connectly.Contracts.Events.Social;

public sealed record FriendRequestCreatedV1(Guid FriendRequestId, Guid RequesterUserId, Guid TargetUserId);

public sealed record FriendshipAcceptedV1(Guid UserLowId, Guid UserHighId);

public sealed record FollowedV1(Guid FollowerId, Guid FolloweeId);

public sealed record BlockedV1(Guid BlockerId, Guid BlockedUserId);

public sealed record UnblockedV1(Guid BlockerId, Guid BlockedUserId);

public sealed record PostPublishedV1(Guid PostId, Guid AuthorUserId, string Visibility, string? TextPreview);

public sealed record PostDeletedV1(Guid PostId, Guid AuthorUserId);

public sealed record CommentCreatedV1(Guid CommentId, Guid PostId, Guid PostAuthorUserId, Guid CommenterUserId, string? TextPreview);

public sealed record ReactionChangedV1(Guid PostId, Guid PostAuthorUserId, Guid ReactorUserId, string ReactionType, bool Removed);

public sealed record PostSharedV1(Guid PostId, Guid PostAuthorUserId, Guid SharedByUserId);

public sealed record GroupJoinRequestedV1(Guid GroupId, string GroupName, Guid RequesterUserId, Guid OwnerUserId);

public sealed record GroupMemberJoinedV1(Guid GroupId, string GroupName, Guid MemberUserId, Guid OwnerUserId);

public sealed record PollVotedV1(Guid PostId, Guid PostAuthorUserId, Guid VoterUserId, int OptionCount);

public sealed record StoryViewedV1(Guid StoryId, Guid StoryAuthorUserId, Guid ViewerUserId, string? CaptionPreview);

/// <summary>A user was tagged with @username inside a post or a comment.</summary>
public sealed record UserMentionedV1(
    Guid TargetUserId,
    Guid AuthorUserId,
    Guid? PostId,
    Guid? CommentId,
    string? Preview);
