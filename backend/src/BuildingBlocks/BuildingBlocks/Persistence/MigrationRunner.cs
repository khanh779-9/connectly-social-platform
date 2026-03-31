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

        using var scope = rootServices.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TDb>();
        var pending = db.Database.GetPendingMigrations().ToList();
        if (pending.Any())
        {
            db.Database.Migrate();
        }
        else if (!db.Database.GetMigrations().Any())
        {
            // dev shortcut before the first `dotnet ef migrations add` was run
            db.Database.EnsureCreated();
        }
    }
}

