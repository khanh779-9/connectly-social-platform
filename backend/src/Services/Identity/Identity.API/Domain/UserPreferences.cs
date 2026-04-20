namespace Identity.Domain;

/// <summary>
/// Per-user settings (one row per user). Every preference the UI can change lives here so it
/// follows the account across devices instead of only living in browser storage.
/// </summary>
public class UserPreferences
{
    public Guid UserId { get; set; }

    /// <summary>light | dark | system</summary>
    public string Theme { get; set; } = "system";

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public User? User { get; set; }

    public const string DefaultTheme = "system";

    public static bool IsValidTheme(string? theme) =>
        theme is "light" or "dark" or "system";
}
