using BuildingBlocks;
using BuildingBlocks.Hosting;
using BuildingBlocks.Messaging;
using Connectly.Contracts.EventTypes;
using Chat.Endpoints;
using Chat.Features;
using Chat.Messaging.Consumers;
using Chat.Persistence;
using Chat.Realtime;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

var builder = ConnectlyHostBuilder.Create(args, "CHAT_HTTP_PORT", defaultPort: 5203);

builder.Services.AddRouting();
builder.Services.AddConnectlyHealth();
builder.Services.AddOpenApi();
builder.Services.AddConnectlyCommon();
builder.Services.AddDbContext<ChatDbContext>(options =>
    options.UseNpgsql(BuildingBlocks.Env.ConnectlyEnv.PostgresConnectionString("chat")));

builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var redis = new ConfigurationOptions
    {
        DefaultDatabase = BuildingBlocks.Env.ConnectlyEnv.RedisDatabase(),
        AbortOnConnectFail = BuildingBlocks.Env.ConnectlyEnv.RedisAbortConnect(),
        Ssl = BuildingBlocks.Env.ConnectlyEnv.RedisSsl(),
        Password = BuildingBlocks.Env.ConnectlyEnv.RedisPassword(),
        // ACL user: required by Redis 6+ providers such as Aiven.
        User = BuildingBlocks.Env.ConnectlyEnv.RedisUser(),
    };
    redis.EndPoints.Add(
        BuildingBlocks.Env.ConnectlyEnv.RedisHost(),
        BuildingBlocks.Env.ConnectlyEnv.RedisPort());
    return ConnectionMultiplexer.Connect(redis);
});
builder.Services.AddSingleton<PresenceService>();
builder.Services.AddSingleton<PresenceRegistry>();
builder.Services.AddHostedService<PresenceKeepAlive>();
builder.Services.AddScoped<ChatGuard>();
builder.Services.AddScoped<ConversationService>();
builder.Services.AddScoped<MessageService>();
builder.Services.AddScoped<ChatSettingsService>();
builder.Services.AddHttpClient<SocialRelationshipClient>(client =>
{
    client.BaseAddress = new Uri(SocialRelationshipClient.BaseAddress());
    client.Timeout = BuildingBlocks.Env.ConnectlyEnv.InternalHttpTimeout();
});

