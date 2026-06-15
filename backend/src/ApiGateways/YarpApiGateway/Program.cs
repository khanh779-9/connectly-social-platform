using System.Text.Json;
using Yarp.ReverseProxy.Configuration;

var builder = BuildingBlocks.Hosting.ConnectlyHostBuilder
    .Create(args, "GATEWAY_PORT", defaultPort: 5000);

builder.Services.AddRouting();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(BuildingBlocks.Env.ConnectlyEnv.CorsOrigin())
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// build YARP config from environment (no hardcoded destinations)
static string Address(string serviceName, int fallbackPort) =>
    BuildingBlocks.Env.ConnectlyEnv.ServiceAddress(serviceName, fallbackPort);

var routes = new List<RouteConfig>();
var clusters = new List<ClusterConfig>();

void AddCluster(string prefix, string serviceName, int fallbackPort)
{
    routes.Add(new RouteConfig
    {
        RouteId = $"{prefix}-route",
        ClusterId = prefix,
        Match = new RouteMatch { Path = $"/{prefix}/{{**catch-all}}" },
        Transforms = [new Dictionary<string, string> { ["PathRemovePrefix"] = $"/{prefix}" }],
        AuthorizationPolicy = "anonymous" // pass-through; each service enforces JWT itself
    });
    clusters.Add(new ClusterConfig
    {
        ClusterId = prefix,
        Destinations = new Dictionary<string, DestinationConfig>
        {
            [prefix] = new DestinationConfig { Address = Address(serviceName, fallbackPort) }
        }
    });
}

