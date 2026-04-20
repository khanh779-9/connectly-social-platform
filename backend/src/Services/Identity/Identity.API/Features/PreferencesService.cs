using Identity.Domain;
using Identity.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Identity.Features;

/// <summary>Reads and writes the signed-in user's settings row (created on first read).</summary>
public sealed class PreferencesService(IdentityDbContext db)
{
    public async Task<UserPreferencesDto> GetAsync(Guid userId, CancellationToken ct)
    {
        var prefs = await db.UserPreferences.AsNoTracking().SingleOrDefaultAsync(p => p.UserId == userId, ct);
        if (prefs is null)
        {
            var now = DateTimeOffset.UtcNow;
            prefs = new UserPreferences
            {
                UserId = userId,
                Theme = UserPreferences.DefaultTheme,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.UserPreferences.Add(prefs);
            await db.SaveChangesAsync(ct);
        }

        return new UserPreferencesDto(prefs.Theme, prefs.UpdatedAt);
    }

    public async Task<UserPreferencesDto> SaveAsync(Guid userId, UpdatePreferencesRequest request, CancellationToken ct)
    {
        if (!UserPreferences.IsValidTheme(request.Theme))
        {
            throw new ArgumentException("theme must be light, dark or system.");
        }

        var prefs = await db.UserPreferences.SingleOrDefaultAsync(p => p.UserId == userId, ct);
        if (prefs is null)
        {
            var now = DateTimeOffset.UtcNow;
            prefs = new UserPreferences
            {
                UserId = userId,
                Theme = request.Theme!,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.UserPreferences.Add(prefs);
        }
        else
        {
            prefs.Theme = request.Theme!;
            prefs.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return new UserPreferencesDto(prefs.Theme, prefs.UpdatedAt);
    }
}

public sealed record UserPreferencesDto(string Theme, DateTimeOffset UpdatedAt);

public sealed record UpdatePreferencesRequest(string? Theme);
