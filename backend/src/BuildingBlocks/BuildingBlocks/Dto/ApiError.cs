namespace BuildingBlocks.Dto;

/// <summary>Normalized API error response shape (RFC 7807-lite).</summary>
public sealed record ApiError(string ErrorCode, string Message);

public sealed record ApiErrorResponse(IReadOnlyList<ApiError> Errors);

