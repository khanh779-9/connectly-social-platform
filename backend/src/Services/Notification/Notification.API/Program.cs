using BuildingBlocks;
using BuildingBlocks.Hosting;
using BuildingBlocks.Messaging;
using NotificationService.Endpoints;
using NotificationService.Features;
using NotifSvc = NotificationService.Services.NotificationService;
using NotificationService.Messaging.Consumers;
using NotificationService.Persistence;
using NotificationService.Realtime;
using Microsoft.EntityFrameworkCore;

var builder = ConnectlyHostBuilder.Create(args, "NOTIFICATION_HTTP_PORT", defaultPort: 5204);

builder.Services.AddRouting();
builder.Services.AddConnectlyHealth();
builder.Services.AddOpenApi();
builder.Services.AddConnectlyCommon();
builder.Services.AddDbContext<NotificationDbContext>(options =>
    options.UseNpgsql(BuildingBlocks.Env.ConnectlyEnv.PostgresConnectionString("notification")));

builder.Services.AddScoped<NotifSvc>();
builder.Services.AddScoped<NotificationQueryService>();

// messaging: no own published events (inbox only), but keep outbox plumbing uniform
builder.Services.AddConnectlyMessaging<NotificationDbContext>("notification", "connectly-notification");
builder.Services
    .AddConnectlyEventConsumer<NotificationDbContext, FriendRequestConsumer>()
    .AddConnectlyEventConsumer<NotificationDbContext, FriendshipAcceptedConsumer>()
    .AddConnectlyEventConsumer<NotificationDbContext, FollowedConsumer>()
    .AddConnectlyEventConsumer<NotificationDbContext, CommentCreatedConsumer>()
    .AddConnectlyEventConsumer<NotificationDbContext, ReactionChangedConsumer>()
    .AddConnectlyEventConsumer<NotificationDbContext, PostSharedConsumer>()
    .AddConnectlyEventConsumer<NotificationDbContext, GroupJoinRequestedConsumer>()
    .AddConnectlyEventConsumer<NotificationDbContext, GroupMemberJoinedConsumer>()
    .AddConnectlyEventConsumer<NotificationDbContext, PollVotedConsumer>()
    .AddConnectlyEventConsumer<NotificationDbContext, StoryViewedConsumer>()
    .AddConnectlyEventConsumer<NotificationDbContext, UserMentionedConsumer>();

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = BuildingBlocks.Env.ConnectlyEnv.SignalREnableDetailedErrors();
    options.KeepAliveInterval = BuildingBlocks.Env.ConnectlyEnv.SignalRKeepAliveInterval();
})
    .AddJsonProtocol(o => o.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

var app = builder.Build();

app.Services.MigrateOnStartup<NotificationDbContext>();

app.UseConnectlyCommon();

app.UseConnectlyHealth();
app.MapOpenApi();
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapNotificationEndpoints();
app.MapInternalNotificationEndpoints();

app.Run();





