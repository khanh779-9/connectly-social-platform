using BuildingBlocks.Auth;
using BuildingBlocks.Messaging;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Social;
using Microsoft.EntityFrameworkCore;
using Social.Domain;
using Social.Persistence;

namespace Social.Features;

/// <summary>
/// The friendships between two users: sending a request, answering it and removing it.
/// </summary>
public class FriendService(
    SocialDbContext db,
    ICurrentUser currentUser,
    ProfileService profiles,
    ILogger<FriendService> logger)
{
    private Guid ViewerId => currentUser.RequireUserId();

    public async Task<FriendRequestResult> SendFriendRequestAsync(Guid targetUserId, CancellationToken ct)
    {
        var me = ViewerId;
        if (targetUserId == me) throw new ArgumentException("You cannot add yourself as a friend.");

        var blocked = await db.Blocks.AnyAsync(x =>
            (x.BlockerId == me && x.BlockedUserId == targetUserId) ||
            (x.BlockerId == targetUserId && x.BlockedUserId == me), ct);
        if (blocked) throw new InvalidOperationException("You cannot send a friend request to this user.");

        var policy = await db.Profiles.AsNoTracking()
            .Where(p => p.UserId == targetUserId)
            .Select(p => (FriendRequestPolicy?)p.FriendRequestPolicy)
            .SingleOrDefaultAsync(ct);
        if (policy == FriendRequestPolicy.FriendsOfFriends)
        {
            var relation = await profiles.RelationToAsync(targetUserId, ct);
            var allowed = relation is ProfileService.Relation.Friend or ProfileService.Relation.FriendOfFriend;
            if (!allowed)
                throw new InvalidOperationException("This user only accepts friend requests from friends of friends.");
        }

        var (low, high) = ProfileService.Order(me, targetUserId);
        var friendship = await db.Friendships.FirstOrDefaultAsync(f => f.UserLowId == low && f.UserHighId == high, ct);
        if (friendship is { Status: FriendshipStatus.Pending or FriendshipStatus.Accepted })
            throw new InvalidOperationException("A friend request already exists for this pair.");

        if (friendship is not null)
        {
            // a declined or cancelled request may be sent again
            friendship.Status = FriendshipStatus.Pending;
            friendship.RequestedByUserId = me;
            friendship.RespondedAt = null;
        }
        else
        {
            friendship = new Friendship
            {
                UserLowId = low,
                UserHighId = high,
                RequestedByUserId = me,
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.Friendships.Add(friendship);
        }

        db.EnqueueEvent(EventTypes.Social.FriendRequestCreated,
            new FriendRequestCreatedV1(friendship.Id, me, targetUserId), EventProducer.Name);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Friend request {Id} sent {From}->{To}", friendship.Id, me, targetUserId);
        return new FriendRequestResult(friendship.Id, me, targetUserId, friendship.Status.ToString().ToLowerInvariant());
    }

    public async Task<FriendRequestResult> AcceptFriendRequestAsync(Guid requestId, CancellationToken ct)
    {
        var friendship = await db.Friendships.SingleOrDefaultAsync(f => f.Id == requestId, ct)
            ?? throw new KeyNotFoundException("Friend request not found.");

        var me = ViewerId;
        if (friendship.RequestedByUserId == me)
            throw new InvalidOperationException("You cannot accept your own friend request.");
        if (friendship.Status != FriendshipStatus.Pending)
            throw new InvalidOperationException("Friend request is not pending.");

        friendship.Status = FriendshipStatus.Accepted;
        friendship.RespondedAt = DateTimeOffset.UtcNow;

        var other = friendship.UserLowId == me ? friendship.UserHighId : friendship.UserLowId;
        db.EnqueueEvent(EventTypes.Social.FriendshipAccepted,
            new FriendshipAcceptedV1(friendship.UserLowId, friendship.UserHighId), EventProducer.Name);
        await db.SaveChangesAsync(ct);

        return new FriendRequestResult(friendship.Id, me, other, "accepted");
    }

    public async Task<IdResult> DeclineFriendRequestAsync(Guid requestId, CancellationToken ct)
    {
        var friendship = await db.Friendships.SingleOrDefaultAsync(f => f.Id == requestId, ct)
            ?? throw new KeyNotFoundException("Friend request not found.");

        var me = ViewerId;
        if (friendship.RequestedByUserId == me)
            throw new InvalidOperationException("Only the receiver can respond.");
        if (friendship.Status != FriendshipStatus.Pending)
            throw new InvalidOperationException("Friend request is not pending.");

        friendship.Status = FriendshipStatus.Declined;
        friendship.RespondedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return new IdResult(friendship.Id);
    }

