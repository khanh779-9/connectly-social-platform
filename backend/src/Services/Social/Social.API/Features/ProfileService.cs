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

