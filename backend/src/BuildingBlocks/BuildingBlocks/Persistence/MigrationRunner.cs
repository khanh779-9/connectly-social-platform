using BuildingBlocks.Env;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BuildingBlocks;

/// <summary>Applies EF migrations on startup when MIGRATE_ON_STARTUP=true (shared by every service).</summary>
public static class MigrationRunner
{
    public static void MigrateOnStartup<TDb>(this IServiceProvider rootServices) where TDb : DbContext
    {
        var migrate = ConnectlyEnv.GetBool("MIGRATE_ON_STARTUP", false);
        if (!migrate) return;

