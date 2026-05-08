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

