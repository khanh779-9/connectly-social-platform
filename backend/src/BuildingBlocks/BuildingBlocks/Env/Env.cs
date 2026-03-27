namespace BuildingBlocks.Env;

/// <summary>
/// Typed accessors for well-known environment variables.
/// No connection details may be hardcoded in service code.
/// </summary>
public static class ConnectlyEnv
{
    public static string Get(string name, string fallback = "") =>
        Environment.GetEnvironmentVariable(name) ?? fallback;

    public static string Require(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } v
            ? v
            : throw new InvalidOperationException($"Missing required environment variable '{name}'. See .env.example.");

    public static int GetInt(string name, int fallback) =>
        int.TryParse(ConnectlyEnv.Get(name), out var v) ? v : fallback;

    public static bool GetBool(string name, bool fallback) =>
        bool.TryParse(ConnectlyEnv.Get(name), out var v) ? v : fallback;

    public static TimeSpan Seconds(string name, int fallback) =>
        TimeSpan.FromSeconds(ConnectlyEnv.GetInt(name, fallback));

    public static TimeSpan Milliseconds(string name, int fallback) =>
        TimeSpan.FromMilliseconds(ConnectlyEnv.GetInt(name, fallback));

    /// <summary>Reads a comma-separated list of integers, e.g. "60,300,900".</summary>
    public static int[] GetIntList(string name, params int[] fallback)
    {
        var parsed = ConnectlyEnv.Get(name)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => int.TryParse(part, out var v) ? v : 0)
            .Where(v => v > 0)
            .ToArray();
        return parsed.Length > 0 ? parsed : fallback;
    }

    // ---------- PostgreSQL ----------
    public static string PostgresConnectionString(string databaseName)
    {
        // Single shared database with per-service schemas (identity, social, chat, notification, hangfire)
        // The databaseName parameter (e.g., "identity", "social", "chat", "notification") is ignored;
        // each service's DbContext uses HasDefaultSchema to select the correct schema.
        var sb = new System.Data.Common.DbConnectionStringBuilder
        {
            ["Host"] = ConnectlyEnv.Get("POSTGRES_HOST", "localhost"),
            ["Port"] = ConnectlyEnv.GetInt("POSTGRES_PORT", 5432).ToString(),
            ["Database"] = ConnectlyEnv.Get("POSTGRES_DATABASE", "connectly-social-db"),
            ["Username"] = ConnectlyEnv.Get("POSTGRES_USER", "postgres"),
            ["Password"] = ConnectlyEnv.Require("POSTGRES_PASSWORD"),
            ["Include Error Detail"] = ConnectlyEnv.GetBool("POSTGRES_INCLUDE_ERROR_DETAIL", true) ? "true" : "false",
            // The pool size has to be capped: a hosted database allows far fewer
            // connections than a local one, and every service opens its own pool
            // (Social opens a second one for Hangfire).
            ["Maximum Pool Size"] = ConnectlyEnv.GetInt("POSTGRES_MAX_POOL_SIZE", 10).ToString(),
            ["Minimum Pool Size"] = ConnectlyEnv.GetInt("POSTGRES_MIN_POOL_SIZE", 0).ToString(),
            ["Timeout"] = ConnectlyEnv.GetInt("POSTGRES_CONNECTION_TIMEOUT_SECONDS", 15).ToString(),
            ["Command Timeout"] = ConnectlyEnv.GetInt("POSTGRES_COMMAND_TIMEOUT_SECONDS", 30).ToString(),
        };

        var sslMode = ConnectlyEnv.Get("POSTGRES_SSL_MODE", "");
        if (!string.IsNullOrWhiteSpace(sslMode)) sb["SSL Mode"] = sslMode;

        return sb.ConnectionString;
    }

    // ---------- Redis ----------
    // Exposed one value at a time: the caller builds a ConfigurationOptions, so no
    // credential has to survive being pasted into a connection string.
    public static string RedisHost() => ConnectlyEnv.Get("REDIS_HOST", "localhost");

    public static int RedisPort() => ConnectlyEnv.GetInt("REDIS_PORT", 6379);

    /// <summary>ACL user (Redis 6+). Empty means the legacy password-only authentication.</summary>
    public static string RedisUser() => ConnectlyEnv.Get("REDIS_USER", "");

    public static string RedisPassword() => ConnectlyEnv.Get("REDIS_PASSWORD", "");

    public static int RedisDatabase() => ConnectlyEnv.GetInt("REDIS_DATABASE", 0);

    public static bool RedisAbortConnect() => ConnectlyEnv.GetBool("REDIS_ABORT_CONNECT", false);

    /// <summary>Cloud providers (Aiven, ...) require TLS on their public endpoint.</summary>
    public static bool RedisSsl() => ConnectlyEnv.GetBool("REDIS_SSL", false);

    // ---------- RabbitMQ ----------
    public static string RabbitMqUri()
    {
        var scheme = ConnectlyEnv.Get("RABBIT_SCHEME", "amqp");
        var host = ConnectlyEnv.Get("RABBIT_HOST", "localhost");
        var port = ConnectlyEnv.GetInt("RABBIT_PORT", 5672);
        var vhost = ConnectlyEnv.Get("RABBIT_VHOST", "/");
        var user = Uri.EscapeDataString(ConnectlyEnv.Get("RABBIT_USER", "connectly"));
        var pass = Uri.EscapeDataString(ConnectlyEnv.Get("RABBIT_PASSWORD", "connectly_dev_password"));

        // "/" is the default vhost and must stay out of the path, otherwise the
        // client would look for a vhost literally named "/".
        var path = vhost is "" or "/" ? "" : "/" + Uri.EscapeDataString(vhost.TrimStart('/'));

        return $"{scheme}://{user}:{pass}@{host}:{port}{path}";
    }

    public static string RabbitEventExchange() => ConnectlyEnv.Get("RABBIT_EVENT_EXCHANGE", "connectly.events");

    public static string RabbitDeadLetterExchange() =>
        ConnectlyEnv.Get("RABBIT_DEAD_LETTER_EXCHANGE", RabbitEventExchange() + ".dlx");

    public static string RabbitQueuePrefix() => ConnectlyEnv.Get("RABBIT_QUEUE_PREFIX", "connectly");

    public static string RabbitDeadLetterQueuePrefix() =>
        ConnectlyEnv.Get("RABBIT_DEAD_LETTER_QUEUE_PREFIX", "connectly.dlq");

    public static ushort RabbitPrefetchCount() => (ushort)ConnectlyEnv.GetInt("RABBIT_PREFETCH_COUNT", 10);

    public static TimeSpan RabbitPublishTimeout() => ConnectlyEnv.Seconds("RABBIT_PUBLISH_TIMEOUT_SECONDS", 10);

    public static TimeSpan RabbitReconnectDelay() => ConnectlyEnv.Seconds("RABBIT_RECONNECT_DELAY_SECONDS", 5);

    // ---------- Service endpoints ----------
    /// <summary>
    /// Where another service lives. "<SERVICE>_ADDRESS" wins when it is set (docker service
    /// names, load balancers); otherwise the address is derived from the service's HTTP port.
    /// </summary>
    public static string ServiceAddress(string serviceName, int defaultPort)
    {
        var key = serviceName.ToUpperInvariant();
        var explicitAddress = ConnectlyEnv.Get($"{key}_ADDRESS");
        if (!string.IsNullOrWhiteSpace(explicitAddress)) return explicitAddress.TrimEnd('/');

        var port = ConnectlyEnv.GetInt($"{key}_HTTP_PORT", defaultPort);
        return $"http://localhost:{port}";
    }

    /// <summary>Base URL Identity uses to push a notification to the Notification service.</summary>
    public static string NotificationApiBase() =>
        ConnectlyEnv.Get("NOTIFICATION_API_BASE", ServiceAddress("notification", 5204) + "/api/v1").TrimEnd('/') + "/";

    /// <summary>Base URL Chat uses to ask the Social service about a relationship.</summary>
    public static string SocialApiBase() =>
        ConnectlyEnv.Get("SOCIAL_API_BASE", ServiceAddress("social", 5202) + "/api/v1").TrimEnd('/') + "/";

    /// <summary>Shared secret for service-to-service calls. Never defaulted: an unset key must fail loudly.</summary>
    public static string InternalApiKey() => ConnectlyEnv.Require("INTERNAL_API_KEY");

    public static TimeSpan InternalHttpTimeout() => ConnectlyEnv.Seconds("INTERNAL_HTTP_TIMEOUT_SECONDS", 5);

    // ---------- HTTP listener ----------
    public static string HttpBindAddress() => ConnectlyEnv.Get("HTTP_BIND_ADDRESS", "0.0.0.0");

    public static string HttpBindScheme() => ConnectlyEnv.Get("HTTP_BIND_SCHEME", "http");

    // ---------- JWT ----------
    public static JwtOptions LoadJwtOptions() => new()
    {
        Secret = ConnectlyEnv.Require("JWT_SECRET"),
        Issuer = ConnectlyEnv.Get("JWT_ISSUER", "connectly-identity"),
        Audience = ConnectlyEnv.Get("JWT_AUDIENCE", "connectly-api"),
        AccessTokenTtlMinutes = ConnectlyEnv.GetInt("JWT_ACCESS_TOKEN_TTL_MINUTES", 15),
        RefreshTokenTtlDays = ConnectlyEnv.GetInt("JWT_REFRESH_TOKEN_TTL_DAYS", 14),
        ClockSkew = ConnectlyEnv.JwtClockSkew()
    };

    public static TimeSpan JwtClockSkew() => ConnectlyEnv.Seconds("JWT_CLOCK_SKEW_SECONDS", 30);

    // ---------- Password policy ----------
    public static int PasswordMinLength() => ConnectlyEnv.GetInt("PASSWORD_MIN_LENGTH", 8);

    public static int PasswordHashIterations() => ConnectlyEnv.GetInt("PASSWORD_HASH_ITERATIONS", 100_000);

    public static int PasswordHashSaltSizeBytes() => ConnectlyEnv.GetInt("PASSWORD_HASH_SALT_SIZE_BYTES", 16);

    public static int PasswordHashKeySizeBytes() => ConnectlyEnv.GetInt("PASSWORD_HASH_KEY_SIZE_BYTES", 32);

    // ---------- Realtime / presence ----------
    public static bool SignalREnableDetailedErrors() =>
        ConnectlyEnv.GetBool("SIGNALR_ENABLE_DETAILED_ERRORS", true);

    public static TimeSpan SignalRKeepAliveInterval() =>
        ConnectlyEnv.Seconds("CHAT_SIGNALR_KEEPALIVE_SECONDS", 15);

    public static TimeSpan PresenceKeepAliveInterval() =>
        ConnectlyEnv.Seconds("CHAT_PRESENCE_KEEPALIVE_SECONDS", 40);

    public static TimeSpan PresenceOnlineTtl() =>
        ConnectlyEnv.Seconds("CHAT_PRESENCE_ONLINE_TTL_SECONDS", 90);

    public static TimeSpan PresenceSeenTtl() =>
        TimeSpan.FromDays(ConnectlyEnv.GetInt("CHAT_PRESENCE_SEEN_TTL_DAYS", 30));

    // ---------- Outbox ----------
    public static TimeSpan OutboxIdleDelay() => ConnectlyEnv.Seconds("OUTBOX_IDLE_DELAY_SECONDS", 2);

    public static TimeSpan OutboxRetryDelay() => ConnectlyEnv.Seconds("OUTBOX_RETRY_DELAY_SECONDS", 5);

    public static int OutboxDispatchBatchSize() => ConnectlyEnv.GetInt("OUTBOX_DISPATCH_BATCH_SIZE", 50);

    // ---------- Geolocation ----------
    public static string GeoIpApiBase() => ConnectlyEnv.Get("GEOIP_API_BASE", "https://ipapi.co").TrimEnd('/');

    public static TimeSpan GeoIpTimeout() => ConnectlyEnv.Milliseconds("GEOIP_TIMEOUT_MILLISECONDS", 1500);

    // ---------- Media / stories / events ----------
    public static long MediaMaxUploadSizeBytes() =>
        ConnectlyEnv.GetInt("MEDIA_MAX_UPLOAD_SIZE_BYTES", 200 * 1024 * 1024);

    public static TimeSpan StoryTtl() => TimeSpan.FromHours(ConnectlyEnv.GetInt("STORY_TTL_HOURS", 24));

    public static TimeSpan MediaStaleUploadTtl() =>
        TimeSpan.FromHours(ConnectlyEnv.GetInt("MEDIA_STALE_UPLOAD_TTL_HOURS", 24));

    public static TimeSpan EventStartGrace() =>
        TimeSpan.FromMinutes(ConnectlyEnv.GetInt("EVENT_START_GRACE_MINUTES", 5));

    // ---------- Hangfire ----------
    public static string HangfireMediaReconciliationCron() =>
        ConnectlyEnv.Get("HANGFIRE_MEDIA_RECONCILIATION_CRON", "0 0 * * *");

    public static int HangfireRetryAttempts() => ConnectlyEnv.GetInt("HANGFIRE_RETRY_ATTEMPTS", 3);

    public static int[] HangfireRetryDelays() => ConnectlyEnv.GetIntList("HANGFIRE_RETRY_DELAYS_SECONDS", 60, 300, 900);

    public static string CorsOrigin() => ConnectlyEnv.Get("CORS_ORIGIN", "http://localhost:3000");
}

public sealed record JwtOptions
{
    public required string Secret { get; init; }
    public required string Issuer { get; init; }
    public required string Audience { get; init; }
    public int AccessTokenTtlMinutes { get; init; }
    public int RefreshTokenTtlDays { get; init; }
    public TimeSpan ClockSkew { get; init; }
}




