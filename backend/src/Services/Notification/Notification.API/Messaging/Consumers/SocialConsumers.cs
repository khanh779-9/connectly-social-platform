using BuildingBlocks.Messaging.Consuming;
using BuildingBlocks.Messaging.Events;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Social;
using NotifSvc = NotificationService.Services.NotificationService;
using NotificationService.Persistence;

namespace NotificationService.Messaging.Consumers;

[EventHandler(EventTypes.Social.FriendRequestCreated)]
public class FriendRequestConsumer(NotifSvc notifications)
    : IntegrationEventHandler<NotificationDbContext, FriendRequestCreatedV1>
{
    public override Task OnHandleAsync(FriendRequestCreatedV1 evt, NotificationDbContext db, EventContext ctx, CancellationToken ct) =>
        notifications.PushAsync(evt.TargetUserId, evt.RequesterUserId, "friend_request", preview: "sent you a friend request", ct: ct);
}

[EventHandler(EventTypes.Social.FriendshipAccepted)]
public class FriendshipAcceptedConsumer(NotifSvc notifications)
    : IntegrationEventHandler<NotificationDbContext, FriendshipAcceptedV1>
{
    // MVP approximation: notify both sides that they are now friends.
    public override async Task OnHandleAsync(FriendshipAcceptedV1 evt, NotificationDbContext db, EventContext ctx, CancellationToken ct)
    {
        await notifications.PushAsync(evt.UserLowId, evt.UserHighId, "friend_accepted", preview: "accepted your friend request", ct: ct);
        await notifications.PushAsync(evt.UserHighId, evt.UserLowId, "friend_accepted", preview: "accepted your friend request", ct: ct);
    }
}

[EventHandler(EventTypes.Social.Followed)]
public class FollowedConsumer(NotifSvc notifications)
    : IntegrationEventHandler<NotificationDbContext, FollowedV1>
{
    public override Task OnHandleAsync(FollowedV1 evt, NotificationDbContext db, EventContext ctx, CancellationToken ct) =>
        notifications.PushAsync(evt.FolloweeId, evt.FollowerId, "followed", preview: "started following you", ct: ct);
}

[EventHandler(EventTypes.Social.CommentCreated)]
public class CommentCreatedConsumer(NotifSvc notifications)
    : IntegrationEventHandler<NotificationDbContext, CommentCreatedV1>
{
    public override Task OnHandleAsync(CommentCreatedV1 evt, NotificationDbContext db, EventContext ctx, CancellationToken ct) =>
        notifications.PushAsync(
            evt.PostAuthorUserId,
            evt.CommenterUserId,
            "comment",
            targetPostId: evt.PostId,
            targetCommentId: evt.CommentId,
            preview: evt.TextPreview,
            ct: ct);
}

[EventHandler(EventTypes.Social.ReactionChanged)]
public class ReactionChangedConsumer(NotifSvc notifications)
    : IntegrationEventHandler<NotificationDbContext, ReactionChangedV1>
{
    public override async Task OnHandleAsync(ReactionChangedV1 evt, NotificationDbContext db, EventContext ctx, CancellationToken ct)
    {
        if (evt.Removed) return;
        await notifications.PushAsync(
            evt.PostAuthorUserId,
            evt.ReactorUserId,
            "reaction",
            targetPostId: evt.PostId,
            preview: evt.ReactionType,
            ct: ct);
    }
}

[EventHandler(EventTypes.Social.PostShared)]
public class PostSharedConsumer(NotifSvc notifications)
    : IntegrationEventHandler<NotificationDbContext, PostSharedV1>
{
    public override Task OnHandleAsync(PostSharedV1 evt, NotificationDbContext db, EventContext ctx, CancellationToken ct) =>
        notifications.PushAsync(
            evt.PostAuthorUserId,
            evt.SharedByUserId,
            "shared",
            targetPostId: evt.PostId,
            preview: "shared your post",
            ct: ct);
}

[EventHandler(EventTypes.Social.GroupJoinRequested)]
public class GroupJoinRequestedConsumer(NotifSvc notifications)
    : IntegrationEventHandler<NotificationDbContext, GroupJoinRequestedV1>
{
    public override Task OnHandleAsync(GroupJoinRequestedV1 evt, NotificationDbContext db, EventContext ctx, CancellationToken ct) =>
        notifications.PushAsync(evt.OwnerUserId, evt.RequesterUserId, "group_request", preview: $"wants to join {evt.GroupName}", ct: ct);
}

[EventHandler(EventTypes.Social.GroupMemberJoined)]
public class GroupMemberJoinedConsumer(NotifSvc notifications)
    : IntegrationEventHandler<NotificationDbContext, GroupMemberJoinedV1>
{
    public override Task OnHandleAsync(GroupMemberJoinedV1 evt, NotificationDbContext db, EventContext ctx, CancellationToken ct) =>
        notifications.PushAsync(evt.OwnerUserId, evt.MemberUserId, "group_member", preview: $"joined {evt.GroupName}", ct: ct);
}

[EventHandler(EventTypes.Social.PollVoted)]
public class PollVotedConsumer(NotifSvc notifications)
    : IntegrationEventHandler<NotificationDbContext, PollVotedV1>
{
    public override Task OnHandleAsync(PollVotedV1 evt, NotificationDbContext db, EventContext ctx, CancellationToken ct) =>
        notifications.PushAsync(
            evt.PostAuthorUserId,
            evt.VoterUserId,
            "poll_vote",
            targetPostId: evt.PostId,
            preview: "voted in your poll",
            ct: ct);
}

[EventHandler(EventTypes.Social.StoryViewed)]
public class StoryViewedConsumer(NotifSvc notifications)
    : IntegrationEventHandler<NotificationDbContext, StoryViewedV1>
{
    public override Task OnHandleAsync(StoryViewedV1 evt, NotificationDbContext db, EventContext ctx, CancellationToken ct) =>
        notifications.PushAsync(evt.StoryAuthorUserId, evt.ViewerUserId, "story_view", preview: "watched your story", ct: ct);
}

[EventHandler(EventTypes.Social.UserMentioned)]
public class UserMentionedConsumer(NotifSvc notifications)
    : IntegrationEventHandler<NotificationDbContext, UserMentionedV1>
{
    public override Task OnHandleAsync(UserMentionedV1 evt, NotificationDbContext db, EventContext ctx, CancellationToken ct) =>
        notifications.PushAsync(
            evt.TargetUserId,
            evt.AuthorUserId,
            "mention",
            targetPostId: evt.PostId,
            targetCommentId: evt.CommentId,
            preview: evt.Preview ?? "mentioned you",
            ct: ct);
}

