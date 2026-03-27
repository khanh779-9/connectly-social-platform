using BuildingBlocks.Dto;
using BuildingBlocks.Pagination;
using Microsoft.AspNetCore.Http;

namespace BuildingBlocks.Exceptions;

/// <summary>
/// Single place that maps domain exceptions to HTTP results for minimal APIs,
/// so endpoint files stay thin and error-shaping is not copy-pasted per service.
///
///     ArgumentException           → 422 Unprocessable  (validation_failed)
///     InvalidCursorException      → 400 Bad Request    (invalid_cursor)
///     KeyNotFoundException        → 404
///     UnauthorizedAccessException → 403 Forbid
///     InvalidOperationException   → 409 Conflict       (`conflictCode`)
///     anything else               → rethrown (5xx by the pipeline)
/// </summary>
public static class ExceptionMapper
{
    public static IResult ToProblem(this Exception ex, string? conflictCode = null) => ex switch
    {
        ArgumentException => Results.UnprocessableEntity(new ApiErrorResponse([new ApiError("validation_failed", ex.Message)])),
        InvalidCursorException => Results.BadRequest(new ApiErrorResponse([new ApiError("invalid_cursor", ex.Message)])),
        KeyNotFoundException => Results.NotFound(),
        UnauthorizedAccessException => Results.Forbid(),
        InvalidOperationException => Results.Conflict(new ApiErrorResponse([new ApiError(conflictCode ?? "conflict", ex.Message)])),
        _ => throw ex,
    };

