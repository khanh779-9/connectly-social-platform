using Chat.Domain;
using Chat.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Chat.Features;

public sealed record ChatSettingsDto(string MessagePrivacy);

public sealed record UpdateChatSettingsRequest(string? MessagePrivacy);

/// <summary>
/// Reads/writes the caller's chat preferences. The row is created on first read so callers
/// always get the defaults instead of a 404.
/// </summary>
public sealed class ChatSettingsService(ChatDbContext db)
{
    public const string Everyone = "everyone";
    public const string Friends = "friends";
    public const string Nobody = "nobody";

    private static bool IsValid(string value) => value is Everyone or Friends or Nobody;

    public async Task<ChatSettingsDto> GetAsync(Guid userId, CancellationToken ct)
    {
        var privacy = await MessagePrivacyOfAsync(userId, ct);
        return new ChatSettingsDto(privacy);
    }

    public async Task<ChatSettingsDto> SaveAsync(Guid userId, UpdateChatSettingsRequest request, CancellationToken ct)
    {
        var value = request.MessagePrivacy?.Trim().ToLowerInvariant();
        if (value is null || !IsValid(value))
            throw new ArgumentException("messagePrivacy must be everyone, friends or nobody.");

        var settings = await db.UserSettings.SingleOrDefaultAsync(s => s.UserId == userId, ct);
        if (settings is null)
        {
            var now = DateTimeOffset.UtcNow;
            settings = new ChatUserSettings { UserId = userId, MessagePrivacy = value, CreatedAt = now, UpdatedAt = now };
            db.UserSettings.Add(settings);
        }
        else
        {
            settings.MessagePrivacy = value;
            settings.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return new ChatSettingsDto(settings.MessagePrivacy);
    }

    /// <summary>Privacy of an arbitrary user, defaulting to "everyone" when they never saved one.</summary>
    public async Task<string> MessagePrivacyOfAsync(Guid userId, CancellationToken ct)
    {
        var stored = await db.UserSettings.AsNoTracking()
            .Where(s => s.UserId == userId)
            .Select(s => s.MessagePrivacy)
            .SingleOrDefaultAsync(ct);
        return stored is not null && IsValid(stored) ? stored : Everyone;
    }
}
