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

        services.AddConnectlyAuth();
        services.AddSingleton<IFileStorage, SeaweedFsStorage>();
        return services;
    }

    public static WebApplication UseConnectlyCommon(this WebApplication app)
    {
        // One place turns an unhandled exception into the shared error shape, so an
        // endpoint that does not wrap its own try/catch still answers with 4xx
        // instead of a 500 with a stack trace.
        app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
        {
            var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
            await exception.ToProblemSafe().ExecuteAsync(context);
        }));

        app.UseCors();
        app.UseAuthentication();
        app.UseAuthorization();
        return app;
    }
}
