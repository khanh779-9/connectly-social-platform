using Amazon.S3;
using Amazon.S3.Model;

namespace BuildingBlocks.Storage;

/// <summary>What the storage reports about an object that was uploaded.</summary>
public sealed record StoredObjectInfo(long SizeBytes, string? ContentType);

public interface IFileStorage
{
    /// <summary>Pre-signed PUT URL so clients upload directly to [stora] without proxying through services.</summary>
    /// <param name="ttlMinutes">0 = use <c>SEAWEED_S3_UPLOAD_URL_TTL_MINUTES</c>.</param>
    Task<string> GenerateUploadUrlAsync(string objectKey, string contentType, int ttlMinutes = 0, CancellationToken ct = default);

    /// <summary>Direct server-side write (used by service-to-service flows).</summary>
    Task PutObjectAsync(string objectKey, Stream content, string contentType, CancellationToken ct = default);

    /// <summary>Pre-signed GET URL for viewing/downloading.</summary>
    /// <param name="ttlMinutes">0 = use <c>SEAWEED_S3_DOWNLOAD_URL_TTL_MINUTES</c>.</param>
    Task<string> GenerateDownloadUrlAsync(string objectKey, int ttlMinutes = 0, CancellationToken ct = default);

    Task DeleteObjectAsync(string objectKey, CancellationToken ct = default);

    /// <summary>
    /// Metadata of a stored object, or null when the object does not exist.
    /// Used to confirm that an upload really landed before the asset is marked ready.
    /// </summary>
    Task<StoredObjectInfo?> GetObjectInfoAsync(string objectKey, CancellationToken ct = default);

    /// <summary>
    /// False when the provider cannot accept a browser upload through a
    /// pre-signed URL; the bytes then have to travel through the service.
    /// </summary>
    bool DirectUploadSupported { get; }

    Task EnsureBucketAsync(CancellationToken ct = default);
}

public sealed class SeaweedFsStorage : IFileStorage
{
    private static readonly SemaphoreSlim EnsureBucketLock = new(1, 1);
    private bool _bucketEnsured;
    private readonly AmazonS3Client _client;
    private readonly SeaweedS3Options _options;

    public SeaweedFsStorage() : this(SeaweedS3Options.Load())
    {
    }

    public SeaweedFsStorage(SeaweedS3Options options)
    {
        _options = options;
        _client = new AmazonS3Client(
            new Amazon.Runtime.BasicAWSCredentials(options.AccessKey, options.SecretKey),
            new AmazonS3Config
            {
                ServiceURL = options.Endpoint,
                ForcePathStyle = options.ForcePathStyle,
                UseHttp = !options.Secure,
                // No RegionEndpoint here: when both ServiceURL and RegionEndpoint are set the SDK
                // resolves the regional AWS endpoint and silently ignores ServiceURL, so requests
                // never reach [stora]. AuthenticationRegion is enough to scope the signature.
                AuthenticationRegion = options.Region,
                // The SDK still defaults to SigV2, which current providers reject
                // with a misleading "bucket does not exist".
                SignatureVersion = options.SignatureVersion
            });
    }

    public bool DirectUploadSupported => _options.DirectUpload;

    public async Task<string> GenerateUploadUrlAsync(
        string objectKey, string contentType, int ttlMinutes = 0, CancellationToken ct = default)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _options.Bucket,
            Key = objectKey,
            Verb = HttpVerb.PUT,
            ContentType = contentType,
            Protocol = ProtocolFor(),
            Expires = DateTime.UtcNow.AddMinutes(ResolveTtl(ttlMinutes, _options.UploadUrlTtlMinutes))
        };
        return _client.GetPreSignedURL(request);
    }

    public async Task<string> GenerateDownloadUrlAsync(string objectKey, int ttlMinutes = 0, CancellationToken ct = default)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _options.Bucket,
            Key = objectKey,
            Verb = HttpVerb.GET,
            Protocol = ProtocolFor(),
            Expires = DateTime.UtcNow.AddMinutes(ResolveTtl(ttlMinutes, _options.DownloadUrlTtlMinutes))
        };
        return _client.GetPreSignedURL(request);
    }

    public async Task PutObjectAsync(string objectKey, Stream content, string contentType, CancellationToken ct = default)
    {
        await EnsureBucketAsync(ct);
        var request = new PutObjectRequest
        {
            BucketName = _options.Bucket,
            Key = objectKey,
            InputStream = content,
            ContentType = contentType,
            // The client measures the body before sending it.
            AutoResetStreamPosition = true
        };
        // Oracle Object Storage only accepts the AWS chunked streaming form.
        if (_options.AwsChunked) request.Headers["Content-Encoding"] = "aws-chunked";
        await _client.PutObjectAsync(request, ct);
    }

    public async Task DeleteObjectAsync(string objectKey, CancellationToken ct = default)
        => await _client.DeleteObjectAsync(new DeleteObjectRequest { BucketName = _options.Bucket, Key = objectKey }, ct);

    public async Task<StoredObjectInfo?> GetObjectInfoAsync(string objectKey, CancellationToken ct = default)
    {
        try
        {
            var response = await _client.GetObjectMetadataAsync(
                new GetObjectMetadataRequest { BucketName = _options.Bucket, Key = objectKey }, ct);
            return new StoredObjectInfo(response.ContentLength, response.Headers.ContentType);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound
                                            || ex.ErrorCode.Contains("NoSuchKey"))
        {
            return null;
        }
    }

    public async Task EnsureBucketAsync(CancellationToken ct = default)
    {
        if (_bucketEnsured) return;
        await EnsureBucketLock.WaitAsync(ct);
        try
        {
            if (_bucketEnsured) return;
            try
            {
                await _client.GetBucketLocationAsync(new GetBucketLocationRequest { BucketName = _options.Bucket }, ct);
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound || ex.ErrorCode.Contains("NoSuchBucket"))
            {
                await _client.PutBucketAsync(new PutBucketRequest { BucketName = _options.Bucket }, ct);
            }
            _bucketEnsured = true;
        }
        finally { EnsureBucketLock.Release(); }
    }

    /// <summary>An explicit TTL wins; otherwise the value configured for this environment applies.</summary>
    private static int ResolveTtl(int requestedMinutes, int configuredMinutes) =>
        requestedMinutes > 0 ? requestedMinutes : configuredMinutes;

    /// <summary>Pre-signed URLs must use the scheme the endpoint really serves.</summary>
    private Protocol ProtocolFor() => _options.Secure ? Protocol.HTTPS : Protocol.HTTP;
}
