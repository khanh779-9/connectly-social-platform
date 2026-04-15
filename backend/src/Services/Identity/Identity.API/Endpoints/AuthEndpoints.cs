using BuildingBlocks.Dto;
using BuildingBlocks.Auth;
using BuildingBlocks.Exceptions;
using Identity.Features;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Identity.Endpoints;

/// <summary>Auth endpoints under /api/v1. Errors use the shared ApiEnvelope shape.</summary>
public static class AuthEndpoints
{
    public const string BasePath = "/api/v1";

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(BasePath);

        group.MapPost("/auth/register", async ([FromBody] RegisterRequest request, AuthService auth, CancellationToken ct) =>
        {
            try
            {
                var result = await auth.RegisterAsync(request, ct);
                return Results.Ok(result);
            }
            catch (Exception ex) { return ex.ToProblem("account_exists"); }
        });

        group.MapPost("/auth/login", async ([FromBody] LoginRequest request, AuthService auth, CancellationToken ct) =>
        {
            try
            {
                var result = await auth.LoginAsync(request, ct);
                return Results.Ok(result);
            }
            catch (UnauthorizedAccessException) { return Results.Unauthorized(); }
        });

