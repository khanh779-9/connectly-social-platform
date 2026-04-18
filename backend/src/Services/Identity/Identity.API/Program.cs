using BuildingBlocks;
using BuildingBlocks.Hosting;
using BuildingBlocks.Messaging;
using Identity.Endpoints;
using Identity.Features;
using Identity.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = ConnectlyHostBuilder.Create(args, "IDENTITY_HTTP_PORT", defaultPort: 5201);

builder.Services.AddRouting();
builder.Services.AddConnectlyHealth();
builder.Services.AddOpenApi();
builder.Services.AddConnectlyCommon();
builder.Services.AddDbContext<IdentityDbContext>(options =>
    options.UseNpgsql(BuildingBlocks.Env.ConnectlyEnv.PostgresConnectionString("identity")));
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<PreferencesService>();
builder.Services.AddScoped<SessionService>();

// messaging: this service writes integration events to its outbox
// (user.registered) and needs the dispatcher to publish them to RabbitMQ.
builder.Services.AddConnectlyMessaging<IdentityDbContext>("identity", AuthService.Producer);
builder.Services.AddHttpClient<NotificationClient>(client =>
{
    client.BaseAddress = new Uri(NotificationClient.BaseAddress());
    client.Timeout = BuildingBlocks.Env.ConnectlyEnv.InternalHttpTimeout();
});

