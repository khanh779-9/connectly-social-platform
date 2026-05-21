using BuildingBlocks;
using BuildingBlocks.Hosting;
using BuildingBlocks.Messaging;
using Connectly.Contracts.EventTypes;
using Social.Endpoints;
using Social.Features;
using Social.Jobs;
using Social.Messaging.Consumers;
using Social.Persistence;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;

var builder = ConnectlyHostBuilder.Create(args, "SOCIAL_HTTP_PORT", defaultPort: 5202);

builder.Services.AddRouting();
builder.Services.AddConnectlyHealth();
builder.Services.AddOpenApi();
builder.Services.AddConnectlyCommon();
builder.Services.AddDbContext<SocialDbContext>(options =>
    options.UseNpgsql(BuildingBlocks.Env.ConnectlyEnv.PostgresConnectionString("social")));

// application services
builder.Services.AddScoped<ProfileService>();
builder.Services.AddScoped<FriendService>();
builder.Services.AddScoped<RelationshipService>();
builder.Services.AddScoped<PostMapper>();
builder.Services.AddScoped<PostAccess>();
builder.Services.AddScoped<PostService>();
builder.Services.AddScoped<CommentService>();
builder.Services.AddScoped<ReactionService>();
builder.Services.AddScoped<FeedService>();
builder.Services.AddScoped<PollService>();
builder.Services.AddScoped<MediaService>();
builder.Services.AddScoped<GroupService>();
builder.Services.AddScoped<EventService>();
builder.Services.AddScoped<PageService>();
builder.Services.AddScoped<StoryService>();
builder.Services.AddScoped<ReelService>();

// messaging: publisher + outbox dispatcher + consumers (idempotent)
// social.post-published is reserved for the fan-out feed and social.post-deleted
// has no consumer yet, so both are published fire-and-forget: a missing queue
// binding must not keep them in the outbox forever.
builder.Services.AddConnectlyMessaging<SocialDbContext>(
    "social",
    EventProducer.Name,
    expectsConsumer: type => type is not (EventTypes.Social.PostPublished or EventTypes.Social.PostDeleted));
builder.Services.AddConnectlyEventConsumer<SocialDbContext, UserRegisteredConsumer>();

// Hangfire (background jobs / reconciliation)
if (BuildingBlocks.Env.ConnectlyEnv.GetBool("HANGFIRE_ENABLED", true))
{
    builder.Services.AddHangfire(config =>
        config.SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
              .UseSimpleAssemblyNameTypeSerializer()
              .UseRecommendedSerializerSettings()
              .UsePostgreSqlStorage(options =>
                  options.UseNpgsqlConnection(BuildingBlocks.Env.ConnectlyEnv.PostgresConnectionString("social")), new PostgreSqlStorageOptions { SchemaName = "hangfire" }));
    builder.Services.AddHangfireServer();

    // Retry policy comes from the environment, so an attribute (which only accepts
    // compile-time constants) cannot carry it.
    Hangfire.GlobalJobFilters.Filters.Add(new Hangfire.AutomaticRetryAttribute
    {
        Attempts = BuildingBlocks.Env.ConnectlyEnv.HangfireRetryAttempts(),
        DelaysInSeconds = BuildingBlocks.Env.ConnectlyEnv.HangfireRetryDelays(),
    });
}

var app = builder.Build();

app.Services.MigrateOnStartup<SocialDbContext>();

app.UseConnectlyCommon();

if (BuildingBlocks.Env.ConnectlyEnv.GetBool("HANGFIRE_ENABLED", true))
{
    app.UseHangfireDashboard("/hangfire");
    RecurringJob.AddOrUpdate<MediaReconciliationJob>("media-reconciliation",
        job => job.MarkOrphanedMediaAssetsAsync(),
        BuildingBlocks.Env.ConnectlyEnv.HangfireMediaReconciliationCron());
}

app.UseConnectlyHealth();
app.MapOpenApi();
app.MapSocialEndpoints();

app.Run();




