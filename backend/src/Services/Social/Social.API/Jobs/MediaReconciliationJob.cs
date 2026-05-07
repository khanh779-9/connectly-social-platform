using Social.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Social.Jobs;

/// <summary>
/// Reconciliation job: soft-deleted posts keep MediaAsset references — engine marks these assets
/// orphaned so [stora] GC can run later (files are never deleted inline with user transactions).
/// </summary>
public class MediaReconciliationJob(IServiceScopeFactory scopeFactory)
{
    public async Task MarkOrphanedMediaAssetsAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SocialDbContext>();

        // Dev-note: avatar/cover lifecycle is out of scope for the skeleton; post media of
        // deleted posts have no PostMedia row by definition, so we expire stale pending assets.
        var stale = await db.MediaAssets
            .Where(a => a.Status == "pending-upload"
                     && a.CreatedAt < DateTimeOffset.UtcNow - BuildingBlocks.Env.ConnectlyEnv.MediaStaleUploadTtl())
            .ToListAsync();
        foreach (var asset in stale) asset.Status = "abandoned";
        await db.SaveChangesAsync();
    }
}

