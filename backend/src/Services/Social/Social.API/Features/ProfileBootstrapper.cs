using Microsoft.EntityFrameworkCore;
using Social.Domain;
using Social.Persistence;

namespace Social.Features;

/// <summary>
/// Creates the profile row for a user.
///
/// Normally the profile arrives with the identity.user-registered event, but a client
/// asks for it as soon as sign-up returns — and two requests ("my profile" and "my
/// privacy") usually arrive together. Creating the profile on demand keeps the first
/// request after sign-up from failing with "Profile not found".
/// </summary>
public static class ProfileBootstrapper
{
    /// <summary>How many times a create is retried before giving up.</summary>
    private const int MaxAttempts = 3;

    public static async Task<Profile> EnsureAsync(
        SocialDbContext db,
        Guid userId,
        string? displayName,
        CancellationToken ct)
    {
        for (var attempt = 0; attempt < MaxAttempts; attempt++)
        {
            var existing = await db.Profiles.FirstOrDefaultAsync(p => p.UserId == userId, ct);
            if (existing is not null) return existing;

            var name = string.IsNullOrWhiteSpace(displayName) ? "New user" : displayName.Trim();
            var profile = new Profile
            {
                UserId = userId,
                DisplayName = name,
                Username = await BuildUniqueUsernameAsync(db, name, userId, ct),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            };
            db.Profiles.Add(profile);

            try
            {
                await db.SaveChangesAsync(ct);
                return profile;
            }
            catch (DbUpdateException)
            {
                // Either the row appeared in the meantime (a parallel request, or the
                // identity.user-registered event), or the @handle collided with another
                // profile. Detach and let the next round see what is really in the table.
                Detach(db, profile);

                var winner = await db.Profiles.FirstOrDefaultAsync(p => p.UserId == userId, ct);
                if (winner is not null) return winner;
            }
        }

        throw new InvalidOperationException($"Could not create the profile for user {userId}.");
    }

    /// <summary>
    /// Derives a unique @handle from the display name. Falls back to a short
    /// user-id suffix when the slug is taken or empty.
    /// </summary>
    private static async Task<string> BuildUniqueUsernameAsync(
        SocialDbContext db,
        string displayName,
        Guid userId,
        CancellationToken ct)
    {
        var slug = UsernameRules.Slugify(displayName);
        var candidate = slug;
        var suffix = 1;
        while (await db.Profiles.AsNoTracking().AnyAsync(p => p.Username == candidate, ct))
        {
            suffix++;
            var tail = suffix.ToString();
            candidate = slug[..Math.Min(slug.Length, UsernameRules.MaxLength - tail.Length - 1)] + "_" + tail;
        }
        if (candidate.Length < UsernameRules.MinLength)
            candidate = ("user_" + userId.ToString("N")[..8])[..UsernameRules.MaxLength];
        return candidate;
    }

    private static void Detach(SocialDbContext db, Profile profile)
    {
        var entry = db.ChangeTracker.Entries<Profile>()
            .FirstOrDefault(e => e.Entity.Id == profile.Id);
        if (entry is not null) entry.State = EntityState.Detached;
    }
}
