using BuildingBlocks.Auth;
using BuildingBlocks.Pagination;
using BuildingBlocks.Messaging;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Social;
using Social.Domain;
using Social.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Social.Features;

public sealed record CreateGroupRequest(string Name, string? Description, GroupVisibility Visibility);
public sealed record UpdateGroupRequest(string? Name, string? Description, GroupVisibility? Visibility);
public sealed record GroupDto(
    Guid Id,
    Guid CreatedByUserId,
    string Name,
    string? Description,
    string Visibility,
    DateTimeOffset CreatedAt,
    int MemberCount = 0,
    string? ViewerRole = null,
    string? ViewerStatus = null);

public sealed record GroupMemberDto(
    Guid UserId,
    string Role,
    string Status,
    DateTimeOffset JoinedAt);

public sealed record GroupSummaryTyped(Guid GroupId, string GroupName, string Visibility);

public class GroupService(
    SocialDbContext db,
    ICurrentUser currentUser,
    ILogger<GroupService> logger)
{
    public const string Producer = EventProducer.Name;
    private Guid ViewerId => currentUser.RequireUserId();

    private static GroupDto ToDto(Group group) => new(
        group.Id, group.CreatedByUserId, group.Name, group.Description,
        group.Visibility.ToString(), group.CreatedAt);

    /// <summary>Creates a group; the creator becomes its Owner with an active membership.</summary>
    public async Task<GroupDto> CreateGroupAsync(CreateGroupRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 120)
            throw new ArgumentException("Group name is empty or too long.");

        var me = ViewerId;
        var now = DateTimeOffset.UtcNow;
        var group = new Group
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Visibility = request.Visibility,
            CreatedByUserId = me,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Groups.Add(group);
        db.GroupMembers.Add(new GroupMember
        {
            GroupId = group.Id, UserId = me, Role = GroupMemberRole.Owner,
            Status = GroupMemberStatus.Active, JoinedAt = now
        });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Group {GroupId} created by {User}", group.Id, me);
        return await WithViewerAsync(ToDto(group), ct);
    }

    /// <summary>Attaches member count and the viewer's own membership to a group DTO (two queries).</summary>
    public async Task<GroupDto> WithViewerAsync(GroupDto dto, CancellationToken ct)
    {
        var memberCount = await db.GroupMembers.AsNoTracking()
            .CountAsync(m => m.GroupId == dto.Id && m.Status == GroupMemberStatus.Active, ct);
        var mine = await db.GroupMembers.AsNoTracking()
            .SingleOrDefaultAsync(m => m.GroupId == dto.Id && m.UserId == ViewerId, ct);
        return dto with
        {
            MemberCount = memberCount,
            ViewerRole = mine?.Role.ToString().ToLowerInvariant(),
            ViewerStatus = mine?.Status.ToString().ToLowerInvariant()
        };
    }

    public async Task<GroupDto> GetGroupAsync(Guid groupId, CancellationToken ct)
    {
        var group = await db.Groups.AsNoTracking().SingleOrDefaultAsync(g => g.Id == groupId, ct)
            ?? throw new KeyNotFoundException("Group not found.");
        return await WithViewerAsync(ToDto(group), ct);
    }

    /// <summary>
    /// Discovery list: public groups plus private groups the viewer belongs to;
    /// pending requests keep their status visible.
    /// </summary>
    public async Task<CursorPageOf<GroupDto>> ListGroupsAsync(string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);
        var me = ViewerId;
        var myGroupIds = await db.GroupMembers.AsNoTracking()
            .Where(m => m.UserId == me).Select(m => m.GroupId).ToListAsync(ct);

        var query = db.Groups.AsNoTracking()
            .Where(g => g.Visibility == GroupVisibility.Public || myGroupIds.Contains(g.Id))
            .OrderByDescending(g => g.CreatedAt).ThenByDescending(g => g.Id);
        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(g => g.CreatedAt < time || (g.CreatedAt == time && g.Id.CompareTo(id) < 0))
                .OrderByDescending(g => g.CreatedAt).ThenByDescending(g => g.Id);
        }

        var rows = await query.Take(limit + 1).ToListAsync(ct);
        var page = rows.Take(limit);
        var nextCursor = rows.Count > limit ? Cursor.Encode(rows[limit].CreatedAt, rows[limit].Id) : null;
        var dtos = new List<GroupDto>();
        foreach (var group in page) dtos.Add(await WithViewerAsync(ToDto(group), ct));
        return new CursorPageOf<GroupDto>(dtos, nextCursor);
    }

    /// <summary>
    /// Server-side search over the groups the viewer may see (public + own memberships).
    /// Returns complete matches, not a filtered page of the newest groups.
    /// </summary>
    public async Task<List<GroupDto>> SearchGroupsAsync(string query, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);
        var needle = query.Trim().ToLowerInvariant();
        if (needle.Length < 2) return [];

        var me = ViewerId;
        var myGroupIds = await db.GroupMembers.AsNoTracking()
            .Where(m => m.UserId == me).Select(m => m.GroupId).ToListAsync(ct);

        var rows = await db.Groups.AsNoTracking()
            .Where(g => g.Visibility == GroupVisibility.Public || myGroupIds.Contains(g.Id))
            .Where(g => g.Name.ToLower().Contains(needle)
                || (g.Description != null && g.Description.ToLower().Contains(needle)))
            .OrderByDescending(g => g.CreatedAt).ThenByDescending(g => g.Id)
            .Take(limit)
            .ToListAsync(ct);

        var dtos = new List<GroupDto>();
        foreach (var group in rows) dtos.Add(await WithViewerAsync(ToDto(group), ct));
        return dtos;
    }

    /// <summary>Groups where the viewer has an active membership.</summary>
    public async Task<List<GroupDto>> ListMyGroupsAsync(CancellationToken ct)
    {
        var rows = await db.GroupMembers.AsNoTracking()
            .Where(m => m.UserId == ViewerId && m.Status == GroupMemberStatus.Active)
            .Join(db.Groups.AsNoTracking(), m => m.GroupId, g => g.Id, (m, g) => new { g, m })
            .OrderByDescending(x => x.m.JoinedAt)
            .ToListAsync(ct);
        var result = new List<GroupDto>();
        foreach (var row in rows) result.Add(await WithViewerAsync(ToDto(row.g), ct));
        return result;
    }

    public async Task<GroupDto> UpdateGroupAsync(Guid groupId, UpdateGroupRequest request, CancellationToken ct)
    {
        var group = await db.Groups.SingleOrDefaultAsync(g => g.Id == groupId, ct)
            ?? throw new KeyNotFoundException("Group not found.");
        if (!await IsModeratorAsync(groupId, ViewerId, ct))
            throw new UnauthorizedAccessException("Only group admins can update this group.");

        if (request.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 120)
                throw new ArgumentException("Group name is empty or too long.");
            group.Name = request.Name.Trim();
        }
        if (request.Description is not null) group.Description = request.Description.Trim();
        if (request.Visibility is not null) group.Visibility = request.Visibility.Value;
        group.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return ToDto(group);
    }

    public async Task DeleteGroupAsync(Guid groupId, CancellationToken ct)
    {
        var group = await db.Groups.SingleOrDefaultAsync(g => g.Id == groupId, ct)
            ?? throw new KeyNotFoundException("Group not found.");
        if (group.CreatedByUserId != ViewerId) throw new UnauthorizedAccessException("Only the owner can delete this group.");

        var now = DateTimeOffset.UtcNow;
        // soft-delete the posts, then drop memberships, group events and the group itself
        await db.Posts.Where(p => p.GroupId == groupId && p.Status != PostStatus.Deleted)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Status, PostStatus.Deleted)
                .SetProperty(p => p.DeletedAt, now), ct);
        await db.Comments.Where(c => db.Posts.Where(p => p.GroupId == groupId)
            .Select(p => p.Id).Contains(c.PostId))
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.Status, "deleted").SetProperty(c => c.UpdatedAt, now), ct);

