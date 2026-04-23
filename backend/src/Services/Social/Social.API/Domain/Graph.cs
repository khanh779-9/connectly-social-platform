namespace Social.Domain;

/// <summary>Who may see one piece of profile information.</summary>
public enum ProfileAudience
{
    Everyone = 0,
    Friends = 1,
    /// <summary>Friends and friends of friends.</summary>
    FriendsOfFriends = 2,
    OnlyMe = 3
}

/// <summary>Who may send this user a friend request.</summary>
public enum FriendRequestPolicy
{
    Everyone = 0,
    FriendsOfFriends = 1
}

public class Profile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = default!;
    /// <summary>Unique @handle used by mentions; null until the user picks one.</summary>
    public string? Username { get; set; }
    public string? Bio { get; set; }
    /// <summary>[stora] object key; serving is via pre-signed URLs, no FK to Media service.</summary>
    public string? AvatarObjectKey { get; set; }
    public string? CoverObjectKey { get; set; }
    public string? Website { get; set; }
    public string? LocationText { get; set; }

    // ---------- contact / personal details (each guarded by its own audience) ----------
    public string? ContactEmail { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? PhoneNumber { get; set; }
    public string? City { get; set; }
    public string? Hometown { get; set; }

    // ---------- privacy (see SocialGraphService for enforcement) ----------
    /// <summary>Visibility preselected in the composer for a new post.</summary>
    public PostVisibility DefaultPostVisibility { get; set; } = PostVisibility.Public;
    public FriendRequestPolicy FriendRequestPolicy { get; set; } = FriendRequestPolicy.Everyone;
    public ProfileAudience AvatarAudience { get; set; } = ProfileAudience.Everyone;
    public ProfileAudience CoverAudience { get; set; } = ProfileAudience.Everyone;
    public ProfileAudience BioAudience { get; set; } = ProfileAudience.Everyone;
    public ProfileAudience WebsiteAudience { get; set; } = ProfileAudience.Everyone;
    public ProfileAudience LocationAudience { get; set; } = ProfileAudience.Everyone;
    public ProfileAudience EmailAudience { get; set; } = ProfileAudience.OnlyMe;
    public ProfileAudience BirthdayAudience { get; set; } = ProfileAudience.Friends;
    public ProfileAudience PhoneAudience { get; set; } = ProfileAudience.OnlyMe;
    public ProfileAudience CityAudience { get; set; } = ProfileAudience.Everyone;
    public ProfileAudience HometownAudience { get; set; } = ProfileAudience.Everyone;
    public ProfileAudience FriendListAudience { get; set; } = ProfileAudience.Everyone;
    public ProfileAudience FollowingAudience { get; set; } = ProfileAudience.Everyone;
    public ProfileAudience FollowersAudience { get; set; } = ProfileAudience.Everyone;
    /// <summary>Everyone = everyone may comment on this user's posts; Friends = friends only.</summary>
    public ProfileAudience CommentAudience { get; set; } = ProfileAudience.Everyone;
    /// <summary>OnlyMe keeps the profile out of name/@handle search results.</summary>
    public ProfileAudience SearchableAudience { get; set; } = ProfileAudience.Everyone;

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public enum FriendshipStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2,
    Cancelled = 3
}

/// <summary>One row per user pair (UserLowId &lt; UserHighId).</summary>
public class Friendship
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserLowId { get; set; }
    public Guid UserHighId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? RespondedAt { get; set; }
}

public class UserFollow
{
    public Guid FollowerId { get; set; }
    public Guid FolloweeId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class UserBlock
{
    public Guid BlockerId { get; set; }
    public Guid BlockedUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class UserMute
{
    public Guid MuterId { get; set; }
    public Guid MutedUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

