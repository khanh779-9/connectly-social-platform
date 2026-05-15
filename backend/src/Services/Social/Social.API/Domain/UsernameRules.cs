using System.Globalization;
using System.Text;

namespace Social.Domain;

/// <summary>
/// Rules for the Facebook-style <c>@username</c> handle used by mentions.
/// Handles are lowercase, start with a letter or digit and contain only
/// letters, digits and underscores (3–30 characters).
/// </summary>
public static class UsernameRules
{
    public const int MinLength = 3;
    public const int MaxLength = 30;

    /// <summary>True when the handle is already in its canonical form.</summary>
    public static bool IsValid(string? username)
    {
        if (string.IsNullOrWhiteSpace(username)) return false;
        if (username.Length is < MinLength or > MaxLength) return false;
        if (!char.IsAsciiLetterOrDigit(username[0])) return false;
        foreach (var c in username)
            if (!char.IsAsciiLetterOrDigit(c) && c != '_') return false;
        return true;
    }

    /// <summary>
    /// Sanitizes a user supplied handle: trims, lowercases and replaces every
    /// unsupported character with an underscore. Returns null when the result
    /// would be too short to be a valid handle.
    /// </summary>
    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var builder = new StringBuilder(MaxLength);
        foreach (var c in raw.Trim().ToLowerInvariant())
        {
            if (builder.Length >= MaxLength) break;
            builder.Append(char.IsAsciiLetterOrDigit(c) || c == '_' ? c : '_');
        }
        var result = builder.ToString().Trim('_');
        return result.Length >= MinLength ? result : null;
    }

    /// <summary>
    /// Derives a candidate handle from a display name ("Alice Nguyen" ->
    /// "alice_nguyen"). Falls back to "user" when nothing usable remains.
    /// </summary>
    public static string Slugify(string? displayName)
    {
        var normalized = Normalize(displayName);
        if (normalized is not null) return normalized;

        // strip diacritics so "Nguyễn" becomes "nguyen" instead of "nguy_n"
        var folded = new StringBuilder(MaxLength);
        var decomposed = (displayName ?? string.Empty).Normalize(System.Text.NormalizationForm.FormD);
        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsAsciiLetterOrDigit(c)) folded.Append(char.ToLowerInvariant(c));
            else if (folded.Length > 0 && folded[^1] != '_') folded.Append('_');
        }
        var slug = folded.ToString().Trim('_');
        return slug.Length >= MinLength ? slug[..Math.Min(slug.Length, MaxLength)] : "user";
    }
}
