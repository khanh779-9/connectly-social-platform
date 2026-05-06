using BuildingBlocks.Auth;
using BuildingBlocks.Storage;
using Microsoft.EntityFrameworkCore;
using Social.Domain;
using Social.Persistence;

namespace Social.Features;

/// <summary>
/// The producer name stamped into every event of the Social service.
/// </summary>
public static class EventProducer
{
    public const string Name = "connectly-social";
}

/// <summary>
/// The profile of a user: reading it, changing it, the privacy settings and the
/// profile picture and cover.
/// </summary>
public class ProfileService(
    SocialDbContext db,
    ICurrentUser currentUser,
    IFileStorage storage)
{
    /// <summary>How the signed-in viewer relates to the owner of a profile.</summary>
    public enum Relation
    {
        Owner,
        Friend,
        FriendOfFriend,
        Stranger
    }

    // One lookup per profile per request is enough; lists would otherwise re-query the same pairs.
    private readonly Dictionary<Guid, Relation> relationCache = new();

    /// <summary>Puts a pair of user ids in a fixed order, so the friendship row is always the same.</summary>
    public static (Guid low, Guid high) Order(Guid a, Guid b) => a < b ? (a, b) : (b, a);

    public static bool CanSee(ProfileAudience audience, Relation relation) => audience switch
    {
        ProfileAudience.Everyone => true,
        ProfileAudience.Friends => relation is Relation.Owner or Relation.Friend,
        ProfileAudience.FriendsOfFriends => relation is Relation.Owner or Relation.Friend or Relation.FriendOfFriend,
        ProfileAudience.OnlyMe => relation is Relation.Owner,
        _ => true
    };

    // ---------- Profile ----------

    public async Task<ProfileDto> GetMyProfileAsync(CancellationToken ct)
    {
        var profile = await ProfileBootstrapper.EnsureAsync(db, currentUser.RequireUserId(), currentUser.DisplayName, ct);
        return await ToDtoAsync(profile, ct);
    }

    public async Task<ProfileDto?> GetProfileAsync(Guid userId, CancellationToken ct)
    {
        // The viewer always has a profile: the row may not exist yet right after
        // sign-up, and a 404 here makes the client cache a missing author for good.
        if (currentUser.UserId == userId)
        {
            var own = await ProfileBootstrapper.EnsureAsync(db, userId, currentUser.DisplayName, ct);
            return await ToDtoAsync(own, ct);
        }

        var profile = await db.Profiles.AsNoTracking().SingleOrDefaultAsync(p => p.UserId == userId, ct);
        return profile is null ? null : await ToDtoAsync(profile, ct);
    }

    public async Task<ProfileDto> UpdateMyProfileAsync(UpdateProfileRequest request, CancellationToken ct)
    {
        var profile = await ProfileBootstrapper.EnsureAsync(db, currentUser.RequireUserId(), currentUser.DisplayName, ct);

        if (request.DisplayName is not null) profile.DisplayName = request.DisplayName.Trim();
        if (request.Username is not null) await ApplyUsernameAsync(profile, request.Username, ct);

        // only the fields that are present are written: a partial PATCH (for example
        // just the display name) must not wipe every other field of the profile
        if (request.Bio is not null) profile.Bio = request.Bio;
        if (request.Website is not null) profile.Website = request.Website;
        if (request.LocationText is not null) profile.LocationText = request.LocationText;
        if (request.ContactEmail is not null) profile.ContactEmail = request.ContactEmail;
        if (request.PhoneNumber is not null) profile.PhoneNumber = request.PhoneNumber;
        if (request.City is not null) profile.City = request.City;
        if (request.Hometown is not null) profile.Hometown = request.Hometown;
        if (request.DateOfBirth is not null) profile.DateOfBirth = ParseBirthday(request.DateOfBirth);

        profile.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(profile, ct);
    }

    /// <summary>Accepts yyyy-MM-dd (or empty to clear) and rejects impossible dates.</summary>
    private static DateOnly? ParseBirthday(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (!DateOnly.TryParse(raw, out var date))
            throw new ArgumentException("dateOfBirth must be a valid date (yyyy-MM-dd).");
        if (date > DateOnly.FromDateTime(DateTime.UtcNow) || date.Year < 1900)
            throw new ArgumentException("dateOfBirth is out of range.");
        return date;
    }

    /// <summary>
    /// Validates and applies a new @handle. The handle must follow the
    /// [a-z0-9_]{3,30} rules and must not be taken by another profile.
    /// </summary>
    private async Task ApplyUsernameAsync(Profile profile, string raw, CancellationToken ct)
    {
        var normalized = UsernameRules.Normalize(raw);
        if (normalized is null)
            throw new ArgumentException("Username must be 3-30 characters, letters/digits/underscore only.");

        var taken = await db.Profiles.AsNoTracking()
            .AnyAsync(p => p.Username == normalized && p.UserId != profile.UserId, ct);
        if (taken) throw new InvalidOperationException("This username is already taken.");

        profile.Username = normalized;
    }

    // ---------- Privacy settings ----------

    public async Task<PrivacySettingsDto> GetPrivacyAsync(CancellationToken ct)
    {
        var profile = await ProfileBootstrapper.EnsureAsync(db, currentUser.RequireUserId(), currentUser.DisplayName, ct);
        return ToPrivacyDto(profile);
    }

    public async Task<PrivacySettingsDto> SavePrivacyAsync(UpdatePrivacyRequest request, CancellationToken ct)
    {
        var profile = await ProfileBootstrapper.EnsureAsync(db, currentUser.RequireUserId(), currentUser.DisplayName, ct);

        // Parse everything before touching the row so a bad value cannot leave a half-applied save.
        var defaultVisibility = ParsePostVisibility(request.DefaultPostVisibility);
        var friendRequestPolicy = ParseFriendRequestPolicy(request.FriendRequestPolicy);
        var avatar = ParseAudience(request.AvatarAudience);
        var cover = ParseAudience(request.CoverAudience);
        var bio = ParseAudience(request.BioAudience);
        var website = ParseAudience(request.WebsiteAudience);
        var location = ParseAudience(request.LocationAudience);
        var email = ParseAudience(request.EmailAudience);
        var birthday = ParseAudience(request.BirthdayAudience);
        var phone = ParseAudience(request.PhoneAudience);
        var city = ParseAudience(request.CityAudience);
        var hometown = ParseAudience(request.HometownAudience);
        var friendList = ParseAudience(request.FriendListAudience);
        var following = ParseAudience(request.FollowingAudience);
        var followers = ParseAudience(request.FollowersAudience);
        var comments = ParseAudience(request.CommentAudience);
        var searchable = ParseAudience(request.SearchableAudience);

        if (defaultVisibility is { } v) profile.DefaultPostVisibility = v;
        if (friendRequestPolicy is { } p) profile.FriendRequestPolicy = p;
        if (avatar is { } av) profile.AvatarAudience = av;
        if (cover is { } cv) profile.CoverAudience = cv;
        if (bio is { } bi) profile.BioAudience = bi;
        if (website is { } we) profile.WebsiteAudience = we;
        if (location is { } lo) profile.LocationAudience = lo;
        if (email is { } em) profile.EmailAudience = em;
        if (birthday is { } bd) profile.BirthdayAudience = bd;
        if (phone is { } ph) profile.PhoneAudience = ph;
        if (city is { } ci) profile.CityAudience = ci;
        if (hometown is { } ht) profile.HometownAudience = ht;
        if (friendList is { } fl) profile.FriendListAudience = fl;
        if (following is { } fo) profile.FollowingAudience = fo;
        if (followers is { } fw) profile.FollowersAudience = fw;
        if (comments is { } cm) profile.CommentAudience = cm;
        if (searchable is { } se) profile.SearchableAudience = se;

        profile.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return ToPrivacyDto(profile);
    }

    // ---------- Profile media ----------

    public async Task<ProfileDto> UpdateAvatarAsync(Guid mediaId, CancellationToken ct)
    {
        var profile = await ProfileBootstrapper.EnsureAsync(db, currentUser.RequireUserId(), currentUser.DisplayName, ct);
        var asset = await db.MediaAssets.SingleOrDefaultAsync(m => m.Id == mediaId, ct)
            ?? throw new KeyNotFoundException("Media asset not found.");
        if (asset.OwnerUserId != currentUser.RequireUserId()) throw new UnauthorizedAccessException("Not your media.");
        if (asset.Status != "ready") throw new InvalidOperationException("Upload is not completed yet.");
        if (asset.Kind is not ("avatar" or "cover")) throw new ArgumentException("Media kind must be avatar or cover.");

        if (asset.Kind == "avatar") profile.AvatarObjectKey = asset.ObjectKey;
        else profile.CoverObjectKey = asset.ObjectKey;

        profile.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(profile, ct);
    }

    public async Task<ProfileDto> UpdateCoverAsync(Guid mediaId, CancellationToken ct)
    {
        var profile = await ProfileBootstrapper.EnsureAsync(db, currentUser.RequireUserId(), currentUser.DisplayName, ct);
        var asset = await db.MediaAssets.SingleOrDefaultAsync(m => m.Id == mediaId, ct)
            ?? throw new KeyNotFoundException("Media asset not found.");
        if (asset.OwnerUserId != currentUser.RequireUserId()) throw new UnauthorizedAccessException("Not your media.");
        if (asset.Status != "ready") throw new InvalidOperationException("Upload is not completed yet.");
        if (asset.Kind is not ("avatar" or "cover")) throw new ArgumentException("Media kind must be avatar or cover.");

        if (asset.Kind == "cover") profile.CoverObjectKey = asset.ObjectKey;
        else profile.AvatarObjectKey = asset.ObjectKey;

        profile.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(profile, ct);
    }

    // ---------- Search ----------

    public async Task<List<ProfileDto>> SearchUsersAsync(string query, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);
        var text = query.Trim();
        if (text.Length < 2) return [];

        var me = currentUser.RequireUserId();
        var needle = text.ToLowerInvariant();
        var profiles = await db.Profiles.AsNoTracking()
            .Where(p => p.SearchableAudience != ProfileAudience.OnlyMe
                && (p.DisplayName.ToLower().Contains(needle) || (p.Bio != null && p.Bio.ToLower().Contains(needle))))
            .OrderBy(p => p.DisplayName)
            .Take(limit * 2)
            .ToListAsync(ct);

        var blocked = await BlockedUserIdsAsync(me, ct);

        var visible = profiles
            .Where(p => p.UserId != me && !blocked.Contains(p.UserId))
            .Take(limit)
            .ToList();

        var result = new List<ProfileDto>();
        foreach (var profile in visible) result.Add(await ToDtoAsync(profile, ct));
        return result;
    }

    /// <summary>Finds a profile by its exact @handle.</summary>
    public async Task<ProfileDto?> GetProfileByUsernameAsync(string username, CancellationToken ct)
    {
        var normalized = UsernameRules.Normalize(username);
        if (normalized is null) return null;

        var profile = await db.Profiles.AsNoTracking().SingleOrDefaultAsync(p => p.Username == normalized, ct);
        return profile is null ? null : await ToDtoAsync(profile, ct);
    }

    /// <summary>
    /// Autocomplete for the mention picker: profiles whose @handle starts with
    /// the query (falls back to a display-name match).
    /// </summary>
    public async Task<List<ProfileDto>> SearchUsernamesAsync(string query, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 20);
        var text = query.Trim().TrimStart('@').ToLowerInvariant();
        if (text.Length == 0) return [];

        var me = currentUser.RequireUserId();
        var blocked = await BlockedUserIdsAsync(me, ct);

        var profiles = await db.Profiles.AsNoTracking()
            .Where(p => p.Username != null && p.UserId != me && !blocked.Contains(p.UserId)
                && p.SearchableAudience != ProfileAudience.OnlyMe)
            .Where(p => p.Username!.StartsWith(text)
                        || p.DisplayName.ToLower().Contains(text))
            .OrderBy(p => p.Username!.StartsWith(text) ? 0 : 1)
            .ThenBy(p => p.Username)
            .Take(limit)
            .ToListAsync(ct);

        var result = new List<ProfileDto>();
        foreach (var profile in profiles) result.Add(await ToDtoAsync(profile, ct));
        return result;
    }

    // ---------- Lists of profiles ----------

    /// <summary>Throws 403 when the owner does not let this viewer open the list.</summary>
    public async Task EnsureCanSeeListAsync(Guid ownerUserId, ProfileAudience audience, CancellationToken ct)
    {
        var relation = await RelationToAsync(ownerUserId, ct);
        if (!CanSee(audience, relation))
            throw new UnauthorizedAccessException("This user's list is not visible to you.");
    }

    public async Task<ProfileAudience> FriendListAudienceOfAsync(Guid userId, CancellationToken ct) =>
        await db.Profiles.AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => p.FriendListAudience)
            .SingleOrDefaultAsync(ct);

    public async Task<ProfileAudience> FollowingAudienceOfAsync(Guid userId, CancellationToken ct) =>
        await db.Profiles.AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => p.FollowingAudience)
            .SingleOrDefaultAsync(ct);

    public async Task<ProfileAudience> FollowersAudienceOfAsync(Guid userId, CancellationToken ct) =>
        await db.Profiles.AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => p.FollowersAudience)
            .SingleOrDefaultAsync(ct);

    public async Task<List<ProfileDto>> GetProfileDtosAsync(IEnumerable<Guid> userIds, CancellationToken ct)
    {
        var ids = userIds.Distinct().ToList();
        var profiles = await db.Profiles.AsNoTracking()
            .Where(p => ids.Contains(p.UserId)).ToDictionaryAsync(p => p.UserId, p => p, ct);

        var result = new List<ProfileDto>();
        foreach (var id in ids)
        {
            var profile = profiles.GetValueOrDefault(id) ?? new Profile { UserId = id, DisplayName = "Unknown" };
            result.Add(await ToDtoAsync(profile, ct));
        }
        return result;
    }

    /// <summary>The users that blocked the viewer, or that the viewer blocked.</summary>
    public async Task<List<Guid>> BlockedUserIdsAsync(Guid userId, CancellationToken ct) =>
        await db.Blocks.AsNoTracking()
            .Where(b => b.BlockerId == userId || b.BlockedUserId == userId)
            .Select(b => b.BlockerId == userId ? b.BlockedUserId : b.BlockerId)
            .ToListAsync(ct);

    // ---------- The relation of the viewer to a profile ----------

    public async Task<Relation> RelationToAsync(Guid ownerUserId, CancellationToken ct)
    {
        var me = currentUser.RequireUserId();
        if (ownerUserId == me) return Relation.Owner;
        if (relationCache.TryGetValue(ownerUserId, out var cached)) return cached;

        var (low, high) = Order(me, ownerUserId);
        var friendship = await db.Friendships.AsNoTracking()
            .SingleOrDefaultAsync(f => f.UserLowId == low && f.UserHighId == high, ct);

        Relation relation;
        if (friendship?.Status == FriendshipStatus.Accepted)
        {
            relation = Relation.Friend;
        }
        else
        {
            var myFriends = await FriendsOfAsync(me, ct);
            var theirFriends = await FriendsOfAsync(ownerUserId, ct);
            myFriends.IntersectWith(theirFriends);
            relation = myFriends.Count > 0 ? Relation.FriendOfFriend : Relation.Stranger;
        }

        relationCache[ownerUserId] = relation;
        return relation;
    }

    private async Task<HashSet<Guid>> FriendsOfAsync(Guid userId, CancellationToken ct)
    {
        var ids = await db.Friendships.AsNoTracking()
            .Where(f => f.Status == FriendshipStatus.Accepted && (f.UserLowId == userId || f.UserHighId == userId))
            .Select(f => f.UserLowId == userId ? f.UserHighId : f.UserLowId)
            .ToListAsync(ct);
        return ids.ToHashSet();
    }

    // ---------- Mapping to the DTO ----------

    private async Task<ProfileDto> ToDtoAsync(Profile profile, CancellationToken ct)
    {
        var relation = await RelationToAsync(profile.UserId, ct);

        return new ProfileDto(
            profile.UserId,
            profile.DisplayName,
            profile.Username,
            CanSee(profile.BioAudience, relation) ? profile.Bio : null,
            CanSee(profile.AvatarAudience, relation) && profile.AvatarObjectKey is not null
                ? await storage.GenerateDownloadUrlAsync(profile.AvatarObjectKey, ct: ct)
                : null,
            CanSee(profile.CoverAudience, relation) && profile.CoverObjectKey is not null
                ? await storage.GenerateDownloadUrlAsync(profile.CoverObjectKey, ct: ct)
                : null,
            CanSee(profile.WebsiteAudience, relation) ? profile.Website : null,
            CanSee(profile.LocationAudience, relation) ? profile.LocationText : null,
            CanSee(profile.EmailAudience, relation) ? profile.ContactEmail : null,
            CanSee(profile.BirthdayAudience, relation) ? profile.DateOfBirth : null,
            CanSee(profile.PhoneAudience, relation) ? profile.PhoneNumber : null,
            CanSee(profile.CityAudience, relation) ? profile.City : null,
            CanSee(profile.HometownAudience, relation) ? profile.Hometown : null,
            profile.CreatedAt);
    }

    // ---------- Names of the settings ----------

    private static string AudienceName(ProfileAudience audience) => audience switch
    {
        ProfileAudience.Friends => "friends",
        ProfileAudience.FriendsOfFriends => "friends_of_friends",
        ProfileAudience.OnlyMe => "only_me",
        _ => "everyone"
    };

    private static ProfileAudience? ParseAudience(string? value)
    {
        if (value is null) return null;

        return value.Trim().ToLowerInvariant() switch
        {
            "everyone" => ProfileAudience.Everyone,
            "friends" => ProfileAudience.Friends,
            "friends_of_friends" => ProfileAudience.FriendsOfFriends,
            "only_me" => ProfileAudience.OnlyMe,
            _ => throw new ArgumentException("audience must be everyone, friends, friends_of_friends or only_me.")
        };
    }

    private static string VisibilityName(PostVisibility visibility) => visibility switch
    {
        PostVisibility.Friends => "friends",
        PostVisibility.OnlyMe => "only_me",
        _ => "public"
    };

    private static PostVisibility? ParsePostVisibility(string? value)
    {
        if (value is null) return null;

        return value.Trim().ToLowerInvariant() switch
        {
            "public" => PostVisibility.Public,
            "friends" => PostVisibility.Friends,
            "only_me" => PostVisibility.OnlyMe,
            _ => throw new ArgumentException("defaultPostVisibility must be public, friends or only_me.")
        };
    }

    private static string FriendRequestPolicyName(FriendRequestPolicy policy) =>
        policy == FriendRequestPolicy.FriendsOfFriends ? "friends_of_friends" : "everyone";

    private static FriendRequestPolicy? ParseFriendRequestPolicy(string? value)
    {
        if (value is null) return null;

        return value.Trim().ToLowerInvariant() switch
        {
            "everyone" => FriendRequestPolicy.Everyone,
            "friends_of_friends" => FriendRequestPolicy.FriendsOfFriends,
            _ => throw new ArgumentException("friendRequestPolicy must be everyone or friends_of_friends.")
        };
    }

    private static PrivacySettingsDto ToPrivacyDto(Profile profile) => new(
        VisibilityName(profile.DefaultPostVisibility),
        FriendRequestPolicyName(profile.FriendRequestPolicy),
        AudienceName(profile.AvatarAudience),
        AudienceName(profile.CoverAudience),
        AudienceName(profile.BioAudience),
        AudienceName(profile.WebsiteAudience),
        AudienceName(profile.LocationAudience),
        AudienceName(profile.EmailAudience),
        AudienceName(profile.BirthdayAudience),
        AudienceName(profile.PhoneAudience),
        AudienceName(profile.CityAudience),
        AudienceName(profile.HometownAudience),
        AudienceName(profile.FriendListAudience),
        AudienceName(profile.FollowingAudience),
        AudienceName(profile.FollowersAudience),
        AudienceName(profile.CommentAudience),
        AudienceName(profile.SearchableAudience));
}

/// <summary>
/// A profile as one viewer sees it: fields the viewer is not allowed to see arrive as null,
/// so the UI never has to apply privacy rules itself.
/// </summary>
public sealed record ProfileDto(
    Guid UserId,
    string DisplayName,
    string? Username,
    string? Bio,
    string? AvatarUrl,
    string? CoverUrl,
    string? Website,
    string? LocationText,
    string? ContactEmail = null,
    DateOnly? DateOfBirth = null,
    string? PhoneNumber = null,
    string? City = null,
    string? Hometown = null,
    DateTimeOffset? JoinedAt = null);

public sealed record UpdateProfileRequest(
    string? DisplayName,
    string? Username,
    string? Bio,
    string? Website,
    string? LocationText,
    string? ContactEmail = null,
    string? DateOfBirth = null,
    string? PhoneNumber = null,
    string? City = null,
    string? Hometown = null);

/// <summary>Audience values crossed over the wire: everyone | friends | friends_of_friends | only_me.</summary>
public sealed record PrivacySettingsDto(
    string DefaultPostVisibility,
    string FriendRequestPolicy,
    string AvatarAudience,
    string CoverAudience,
    string BioAudience,
    string WebsiteAudience,
    string LocationAudience,
    string EmailAudience,
    string BirthdayAudience,
    string PhoneAudience,
    string CityAudience,
    string HometownAudience,
    string FriendListAudience,
    string FollowingAudience,
    string FollowersAudience,
    string CommentAudience,
    string SearchableAudience);

/// <summary>Every property is optional so the settings page can save one switch at a time.</summary>
public sealed record UpdatePrivacyRequest(
    string? DefaultPostVisibility = null,
    string? FriendRequestPolicy = null,
    string? AvatarAudience = null,
    string? CoverAudience = null,
    string? BioAudience = null,
    string? WebsiteAudience = null,
    string? LocationAudience = null,
    string? EmailAudience = null,
    string? BirthdayAudience = null,
    string? PhoneAudience = null,
    string? CityAudience = null,
    string? HometownAudience = null,
    string? FriendListAudience = null,
    string? FollowingAudience = null,
    string? FollowersAudience = null,
    string? CommentAudience = null,
    string? SearchableAudience = null);

public sealed record UpdateProfileMediaRequest(Guid MediaId);
