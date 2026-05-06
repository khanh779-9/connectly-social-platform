using BuildingBlocks.Auth;
using BuildingBlocks.Storage;
using Social.Domain;
using Social.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Social.Features;

public sealed record CreateUploadRequest(string ContentType, long SizeBytes, string Kind);
public sealed record UploadTicket(Guid MediaId, string UploadUrl, string ObjectKey, string ContentType, bool DirectUpload);

public class MediaService(SocialDbContext db, ICurrentUser currentUser, IFileStorage storage)
{
    private static readonly string[] AllowedKinds = ["avatar", "cover", "images", "videos", "stories", "post"];
    private static readonly long MaxSizeBytes = BuildingBlocks.Env.ConnectlyEnv.MediaMaxUploadSizeBytes();

    /// <summary>
    /// [stora] 2-step upload: (1) request a pre-signed PUT ticket, (2) client uploads directly
    /// to SeaweedFS, (3) mark the asset ready and attach by MediaAssetIds.
    /// </summary>
    public async Task<UploadTicket> CreateUploadTicketAsync(CreateUploadRequest request, CancellationToken ct)
    {
        var me = currentUser.RequireUserId();
        if (!AllowedKinds.Contains(request.Kind))
            throw new ArgumentException($"Kind must be one of: {string.Join(", ", AllowedKinds)}.");
        if (string.IsNullOrWhiteSpace(request.ContentType)) throw new ArgumentException("ContentType is required.");
        // the object is served back with this content type, so only renderable media is accepted
        if (!StoraLayout.IsAllowedMediaContentType(request.ContentType))
            throw new ArgumentException($"ContentType must be one of: {string.Join(", ", StoraLayout.AllowedMediaContentTypes)}.");
        if (request.SizeBytes < 1 || request.SizeBytes > MaxSizeBytes) throw new ArgumentException("SizeBytes out of range.");

        var asset = new MediaAsset
        {
            OwnerUserId = me,
            ObjectKey = BuildObjectKey(me, request.Kind, request.ContentType),
            ContentType = request.ContentType,
            SizeBytes = request.SizeBytes,
            Kind = request.Kind,
            CreatedAt = DateTimeOffset.UtcNow
        };
        await db.MediaAssets.AddAsync(asset, ct);
        await db.SaveChangesAsync(ct);

        await storage.EnsureBucketAsync(ct);
        var direct = storage.DirectUploadSupported;
        var uploadUrl = direct
            ? await storage.GenerateUploadUrlAsync(asset.ObjectKey, request.ContentType, ct: ct)
            : string.Empty;
        return new UploadTicket(asset.Id, uploadUrl, asset.ObjectKey, request.ContentType, direct);
    }

    /// <summary>
    /// Writes the bytes through the service for providers that cannot take a
    /// browser upload (the client posted the file to the upload endpoint).
    /// </summary>
    public async Task UploadContentAsync(Guid mediaId, Stream content, CancellationToken ct)
    {
        var asset = await db.MediaAssets.SingleOrDefaultAsync(m => m.Id == mediaId && m.OwnerUserId == currentUser.RequireUserId(), ct)
            ?? throw new KeyNotFoundException("Media asset not found.");
        if (asset.Status != "pending-upload")
            throw new InvalidOperationException("This upload is not open anymore.");

        // The storage client has to know the body length before it sends
        // anything, so the stream is spooled to disk first: a 200 MB video must
        // not sit in memory.
        var spool = Path.Combine(Path.GetTempPath(), $"connectly-upload-{mediaId:N}{Path.GetExtension(asset.ObjectKey)}");
        try
        {
            await using (var file = File.Create(spool))
                await content.CopyToAsync(file, ct);

            // the ticket fixes the size, so a body that does not match it is refused
            var written = new FileInfo(spool).Length;
            if (written > MaxSizeBytes || written > asset.SizeBytes)
                throw new InvalidOperationException("The uploaded file is larger than the ticket allows.");

            await using var stream = new FileStream(
                spool, FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024, useAsync: true);
            // the asset's content type is the validated one, not whatever the request claimed
            await storage.PutObjectAsync(asset.ObjectKey, stream, asset.ContentType, ct);
        }
        finally
        {
            try { File.Delete(spool); } catch { /* a leftover temp file is harmless */ }
        }
    }

    public async Task<string> CompleteUploadAsync(Guid mediaId, CancellationToken ct)
    {
        var asset = await db.MediaAssets.SingleOrDefaultAsync(m => m.Id == mediaId && m.OwnerUserId == currentUser.RequireUserId(), ct)
            ?? throw new KeyNotFoundException("Media asset not found.");
        if (asset.Status != "ready")
        {
            // the object has to be in the bucket before the asset is marked ready,
            // otherwise a ticket that was never used would publish a broken image
            var stored = await storage.GetObjectInfoAsync(asset.ObjectKey, ct);
            if (stored is null)
                throw new InvalidOperationException("The file was not uploaded yet.");
            if (stored.SizeBytes > MaxSizeBytes)
                throw new InvalidOperationException("The uploaded file is too large.");

            asset.Status = "ready";
            asset.SizeBytes = stored.SizeBytes;
            await db.SaveChangesAsync(ct);
        }
        return await storage.GenerateDownloadUrlAsync(asset.ObjectKey, ct: ct);
    }

    /// <summary>Object key keeps a real extension derived from the upload's MIME type.</summary>
    private static string BuildObjectKey(Guid userId, string kind, string contentType)
    {
        var ext = StoraLayout.ExtensionForContentType(contentType);
        return kind switch
        {
            "avatar" => StoraLayout.PersonObjectKey(userId, MediaKind.PersonAvatar, $"avatar{ext}"),
            "cover" => StoraLayout.PersonObjectKey(userId, MediaKind.PersonCover, $"cover{ext}"),
            "images" => StoraLayout.PersonObjectKey(userId, MediaKind.PersonImage, $"image{ext}"),
            "videos" => StoraLayout.PersonObjectKey(userId, MediaKind.PersonVideo, $"video{ext}"),
            "stories" => StoraLayout.PersonObjectKey(userId, MediaKind.PersonStory, $"story{ext}"),
            _ => StoraLayout.PostObjectKey($"post{ext}")
        };
    }
}


