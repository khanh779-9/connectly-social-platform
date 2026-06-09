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

