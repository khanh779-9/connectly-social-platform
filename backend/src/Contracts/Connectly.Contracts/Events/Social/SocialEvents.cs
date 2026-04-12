namespace Connectly.Contracts.Events.Social;

public sealed record FriendRequestCreatedV1(Guid FriendRequestId, Guid RequesterUserId, Guid TargetUserId);

public sealed record FriendshipAcceptedV1(Guid UserLowId, Guid UserHighId);

public sealed record FollowedV1(Guid FollowerId, Guid FolloweeId);

public sealed record BlockedV1(Guid BlockerId, Guid BlockedUserId);

public sealed record UnblockedV1(Guid BlockerId, Guid BlockedUserId);

public sealed record PostPublishedV1(Guid PostId, Guid AuthorUserId, string Visibility, string? TextPreview);

public sealed record PostDeletedV1(Guid PostId, Guid AuthorUserId);

public sealed record CommentCreatedV1(Guid CommentId, Guid PostId, Guid PostAuthorUserId, Guid CommenterUserId, string? TextPreview);

