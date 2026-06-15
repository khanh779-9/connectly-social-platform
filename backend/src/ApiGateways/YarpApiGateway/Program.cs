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

AddCluster("identity", "identity", 5201);
AddCluster("social", "social", 5202);
AddCluster("chat", "chat", 5203);
AddCluster("notification", "notification", 5204);

builder.Services.AddReverseProxy()
    .LoadFromMemory(routes, clusters);

var app = builder.Build();

app.UseCors();
app.MapReverseProxy();

// friendly root
app.MapGet("/", () => Results.Json(new { name = "connectly-gateway", status = "ok" }));

app.Run();


