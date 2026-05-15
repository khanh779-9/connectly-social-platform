using System.Text.RegularExpressions;

namespace Social.Domain;

/// <summary>
/// Extracts <c>@username</c> handles out of free text. A handle is only
/// recognized when it is not glued to a word (email-like strings are skipped)
/// and when it matches the username rules.
/// </summary>
public static class MentionParser
{
    private static readonly Regex MentionPattern = new(
        @"(?<![\w@.])@([A-Za-z0-9_]{1,30})\b",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    /// <summary>Distinct lowercase usernames found in the text (max 20).</summary>
    public static List<string> ExtractUsernames(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];
        var result = new List<string>();
        foreach (Match match in MentionPattern.Matches(text))
        {
            var candidate = match.Groups[1].Value.ToLowerInvariant();
            if (!UsernameRules.IsValid(candidate)) continue;
            if (!result.Contains(candidate)) result.Add(candidate);
            if (result.Count >= 20) break;
        }
        return result;
    }
}
