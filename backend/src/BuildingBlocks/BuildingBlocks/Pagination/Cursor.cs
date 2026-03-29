namespace BuildingBlocks.Pagination;

/// <summary>The pagination cursor is malformed or was tampered with.</summary>
public sealed class InvalidCursorException : Exception
{
    public InvalidCursorException(string message) : base(message) { }
}

/// <summary>
/// Cursor codec for keyset pagination, shared by all services:
/// cursor = base64("{DateTimeOffset:O}|{id}") — the tie-breaker Guid is the entity PK.
///
/// Contract: a cursor always encodes the LAST row that was handed to the client.
/// The next page then selects the rows that come strictly after it in the sort
/// order, so no row is skipped and no row is returned twice. A cursor that points
/// at a row the client never saw (the "look-ahead" row) drops that row from the
/// next page, which is why the two encodings must not be mixed.
/// </summary>
public static class Cursor
{
    public static string Encode(DateTimeOffset time, Guid id) =>
        Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{time:O}|{id}"));

    public static (DateTimeOffset time, Guid id) Parse(string cursor)
    {
        string raw;
        try
        {
            raw = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(cursor));
        }
        catch (FormatException)
        {
            throw new InvalidCursorException("The cursor is not a valid pagination token.");
        }

        var parts = raw.Split('|');
        if (parts.Length != 2 || !DateTimeOffset.TryParse(parts[0], out var time) || !Guid.TryParse(parts[1], out var id))
            throw new InvalidCursorException("The cursor is not a valid pagination token.");
        return (time, id);
    }
}
