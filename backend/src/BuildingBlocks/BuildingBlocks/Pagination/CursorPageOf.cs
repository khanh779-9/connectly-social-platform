namespace BuildingBlocks.Pagination;

/// <summary>Cursor-paginated page returned by list endpoints.</summary>
public sealed record CursorPageOf<T>(IReadOnlyList<T> Items, string? NextCursor);

