using BuildingBlocks.Auth;
using BuildingBlocks.Messaging;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Social;
using Microsoft.EntityFrameworkCore;
using Social.Domain;
using Social.Persistence;

namespace Social.Features;

/// <summary>
/// How the users of the app relate to each other: following, blocking and muting.
/// </summary>
public class RelationshipService(
    SocialDbContext db,
    ICurrentUser currentUser,
    ProfileService profiles)
{
    private Guid ViewerId => currentUser.RequireUserId();

    // ---------- The relationship of the viewer ----------

    public async Task<RelationshipDto> GetRelationshipAsync(Guid userId, CancellationToken ct)
    {
        var me = ViewerId;
        var (low, high) = ProfileService.Order(me, userId);
        var friendship = await db.Friendships.AsNoTracking()
            .SingleOrDefaultAsync(f => f.UserLowId == low && f.UserHighId == high, ct);

        var isFollowing = await db.Follows.AsNoTracking().AnyAsync(f => f.FollowerId == me && f.FolloweeId == userId, ct);
        var isBlocked = await db.Blocks.AsNoTracking().AnyAsync(b => b.BlockerId == me && b.BlockedUserId == userId, ct);
        var isMuted = await db.Mutes.AsNoTracking().AnyAsync(m => m.MuterId == me && m.MutedUserId == userId, ct);
        var followerCount = await db.Follows.AsNoTracking().CountAsync(f => f.FolloweeId == userId, ct);
        var followingCount = await db.Follows.AsNoTracking().CountAsync(f => f.FollowerId == me, ct);
        var friendCount = await db.Friendships.AsNoTracking()
            .CountAsync(f => f.Status == FriendshipStatus.Accepted && (f.UserLowId == userId || f.UserHighId == userId), ct);

        return new RelationshipDto(
            IsFriend: friendship?.Status == FriendshipStatus.Accepted,
            IsFollowing: isFollowing,
            HasIncomingRequest: friendship?.Status == FriendshipStatus.Pending && friendship.RequestedByUserId != me,
            HasOutgoingRequest: friendship?.Status == FriendshipStatus.Pending && friendship.RequestedByUserId == me,
            IsBlocked: isBlocked,
            IsMuted: isMuted,
            FollowerCount: followerCount,
            FollowingCount: followingCount,
            FriendCount: friendCount);
    }

    // ---------- Followers and following ----------

    public async Task<List<ProfileDto>> ListFollowersAsync(Guid userId, CancellationToken ct)
    {
        var audience = await profiles.FollowersAudienceOfAsync(userId, ct);
        await profiles.EnsureCanSeeListAsync(userId, audience, ct);

        var ids = await db.Follows.AsNoTracking()
            .Where(f => f.FolloweeId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => f.FollowerId)
            .ToListAsync(ct);

        return await profiles.GetProfileDtosAsync(ids, ct);
    }

    public async Task<List<ProfileDto>> ListFollowingAsync(Guid userId, CancellationToken ct)
    {
        var audience = await profiles.FollowingAudienceOfAsync(userId, ct);
        await profiles.EnsureCanSeeListAsync(userId, audience, ct);

        var ids = await db.Follows.AsNoTracking()
            .Where(f => f.FollowerId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => f.FolloweeId)
            .ToListAsync(ct);

        return await profiles.GetProfileDtosAsync(ids, ct);
    }

    // ---------- Follow ----------

    public async Task FollowAsync(Guid userId, CancellationToken ct)
    {
        var me = ViewerId;
        if (userId == me) throw new ArgumentException("You cannot follow yourself.");

        var blocked = await db.Blocks.AnyAsync(x =>
            (x.BlockerId == me && x.BlockedUserId == userId) ||
            (x.BlockerId == userId && x.BlockedUserId == me), ct);
        if (blocked) throw new InvalidOperationException("You cannot follow this user.");

