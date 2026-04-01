using BuildingBlocks.Env;
using BuildingBlocks.Auth;
using BuildingBlocks.Exceptions;
using BuildingBlocks.Storage;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace BuildingBlocks;

public static class CommonSetup
{
    /// <summary>Registers auth, current-user, CORS and [stora] storage for a Connectly service.</summary>
    public static IServiceCollection AddConnectlyCommon(this IServiceCollection services)
    {
        services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.WithOrigins(ConnectlyEnv.CorsOrigin())
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
            options.AddPolicy("gateway", policy =>
            {
                policy.WithOrigins(ConnectlyEnv.CorsOrigin())
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

