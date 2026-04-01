using BuildingBlocks.Env;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace BuildingBlocks.Hosting;

/// <summary>
/// Shared host bootstrap for all Connectly services: loads .env and binds the HTTP port
/// from environment variables (no hardcoded ports in service code).
/// </summary>
public static class ConnectlyHostBuilder
{
    public static WebApplicationBuilder Create(string[] args, string portEnvVar, int defaultPort)
    {
        DotEnv.Load();
        var builder = WebApplication.CreateBuilder(args);
        var port = ConnectlyEnv.GetInt(portEnvVar, defaultPort);
        var address = ConnectlyEnv.HttpBindAddress();
        var scheme = ConnectlyEnv.HttpBindScheme();
        builder.WebHost.UseUrls($"{scheme}://{address}:{port}");
        return builder;
    }
}

