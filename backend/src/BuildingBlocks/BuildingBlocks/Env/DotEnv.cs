namespace BuildingBlocks.Env;

/// <summary>
/// Loads a root-level `.env` file into process environment variables.
/// Real (already set) environment variables always win over file values.
/// </summary>
public static class DotEnv
{
    public static void Load(string? path = null)
    {
        var file = path ?? FindUp(".env", Directory.GetCurrentDirectory(), maxLevels: 6);
        if (file is null || !File.Exists(file)) return;

        foreach (var raw in File.ReadAllLines(file))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith("#")) continue;
            var idx = line.IndexOf('=');
            if (idx <= 0) continue;

            var key = line[..idx].Trim();
            var value = line[(idx + 1)..].Trim();
            if (value.Length >= 2 && ((value.StartsWith('"') && value.EndsWith('"')) || (value.StartsWith('\'') && value.EndsWith('\''))))
                value = value[1..^1];

