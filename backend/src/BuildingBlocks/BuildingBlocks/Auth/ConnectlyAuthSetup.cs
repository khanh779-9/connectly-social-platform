using System.Security.Claims;
using BuildingBlocks.Env;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace BuildingBlocks.Auth;

public interface ICurrentUser
{
    Guid? UserId { get; }
    Guid RequireUserId();

    /// <summary>Display name from the token ("name" claim).</summary>
    string? DisplayName { get; }

    /// <summary>Email from the token ("email" claim).</summary>
    string? Email { get; }
}

public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid? UserId
    {
        get
        {
            var sub = accessor.HttpContext?.User.FindFirstValue("sub")
                   ?? accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(sub, out var id) ? id : null;
        }
    }

    public Guid RequireUserId() =>
        UserId ?? throw new UnauthorizedAccessException("Authenticated user id claim missing.");

    public string? DisplayName =>
        accessor.HttpContext?.User.FindFirstValue("name")
        ?? accessor.HttpContext?.User.FindFirstValue(ClaimTypes.Name);

    public string? Email =>
        accessor.HttpContext?.User.FindFirstValue("email")
        ?? accessor.HttpContext?.User.FindFirstValue(ClaimTypes.Email);
}

public static class ConnectlyAuthSetup
{
    public static IServiceCollection AddConnectlyAuth(this IServiceCollection services)
    {
        var jwt = ConnectlyEnv.LoadJwtOptions();

