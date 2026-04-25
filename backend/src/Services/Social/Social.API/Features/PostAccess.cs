using BuildingBlocks.Auth;
using Microsoft.EntityFrameworkCore;
using Social.Domain;
using Social.Persistence;

namespace Social.Features;

/// <summary>
/// The rules that decide whether the viewer may see a post. Every service that
/// returns a post asks here first, so the privacy policy lives in one place.
/// </summary>
public class PostAccess(
    SocialDbContext db,
    ICurrentUser currentUser)
{
    private Guid ViewerId => currentUser.RequireUserId();

    /// <summary>
    /// True when the viewer may read the post at all: the post must not be deleted,
    /// the two must not have blocked each other, and the visibility must allow it.
    /// </summary>
    public async Task<bool> CanReadAsync(Post post, CancellationToken ct)
    {
        if (post.Status == PostStatus.Deleted) return false;

        // a block works in both directions
        if (post.AuthorUserId != ViewerId)
        {
            var blocked = await db.Blocks.AnyAsync(b =>
                (b.BlockerId == ViewerId && b.BlockedUserId == post.AuthorUserId) ||
                (b.BlockerId == post.AuthorUserId && b.BlockedUserId == ViewerId), ct);
            if (blocked) return false;
        }

        return await CanViewAsync(post, ct);
    }

    public async Task<bool> CanViewAsync(Post post, CancellationToken ct)
    {
        // the author always sees their own post
        if (post.AuthorUserId == ViewerId) return true;
        if (post.Status != PostStatus.Published) return false;

        // posts of a group: public groups are readable by anyone, private groups only by members
        if (post.GroupId is { } groupId)
        {
            var group = await db.Groups.AsNoTracking().SingleOrDefaultAsync(g => g.Id == groupId, ct);
            if (group is null) return false;
            if (group.Visibility == GroupVisibility.Public) return true;

            return await db.GroupMembers.AsNoTracking().AnyAsync(m =>
                m.GroupId == groupId && m.UserId == ViewerId && m.Status == GroupMemberStatus.Active, ct);
        }

        // posts of a page are public
        if (post.PageId is not null) return true;

        if (post.Visibility == PostVisibility.Public) return true;
        if (post.Visibility == PostVisibility.Friends) return await IsFriendAsync(post.AuthorUserId, ViewerId, ct);
        return false;
    }

    public async Task<bool> IsFriendAsync(Guid userA, Guid userB, CancellationToken ct)
    {
        var low = userA < userB ? userA : userB;
        var high = userA < userB ? userB : userA;

        return await db.Friendships.AnyAsync(f =>
            f.UserLowId == low && f.UserHighId == high && f.Status == FriendshipStatus.Accepted, ct);
    }
}
