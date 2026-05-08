namespace Social.Domain;

public enum GroupVisibility
{
    Public = 0,   // anyone can see the group; joining is instant
    Private = 1   // content and members are visible to members; joining requires approval
}

/// <summary>A page represents an organisation/brand that publishes posts (blueprint: Pages / PageAdmins).</summary>
public class Page
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string? AvatarObjectKey { get; set; }
    public string? CoverObjectKey { get; set; }
    public Guid OwnerUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class PageAdmin
{
    public Guid PageId { get; set; }
    public Guid UserId { get; set; }
    public PageAdminRole Role { get; set; } = PageAdminRole.Admin;
    public DateTimeOffset AddedAt { get; set; }
}

public enum PageAdminRole
{
    Owner = 0,
    Admin = 1,
    Editor = 2,
    Moderator = 3
}

public class Group
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public GroupVisibility Visibility { get; set; } = GroupVisibility.Public;
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>Membership + join-request rows live here (status Pending = join request).</summary>
public class GroupMember
{
    public Guid GroupId { get; set; }
    public Guid UserId { get; set; }
    public GroupMemberRole Role { get; set; } = GroupMemberRole.Member;
    public GroupMemberStatus Status { get; set; } = GroupMemberStatus.Active;
    public DateTimeOffset JoinedAt { get; set; }
}

public enum GroupMemberRole
{
    Owner = 0,
    Admin = 1,
    Moderator = 2,
    Member = 3
}

public enum GroupMemberStatus
{
    Active = 0,
    Pending = 1
}

public class Event
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public string? LocationText { get; set; }
    public string? OnlineUrl { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset? EndsAt { get; set; }
    public Guid HostUserId { get; set; }
    /// <summary>Set when the event is hosted by a group; otherwise a personal event.</summary>
    public Guid? GroupId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class EventAttendee
{
    public Guid EventId { get; set; }
    public Guid UserId { get; set; }
    public RsvpStatus Rsvp { get; set; } = RsvpStatus.Going;
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Facebook RSVP set: Interested / Going / Not going.</summary>
public enum RsvpStatus
{
    Going = 0,
    Interested = 1,
    NotGoing = 2
}
