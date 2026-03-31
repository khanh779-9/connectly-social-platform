using BuildingBlocks.Env;

namespace BuildingBlocks.Storage;

/// <summary>
/// Every [stora]/SeaweedFS setting, read from the environment (`.env`) so no value is baked into
/// call sites. Defaults mirror `backend/.env.example` for local development.
/// </summary>
public sealed record SeaweedS3Options
{
    /// <summary>S3 endpoint, e.g. <c>http://localhost:8333</c>. The scheme also decides HTTPS/HTTP.</summary>
    public required string Endpoint { get; init; }

    public required string AccessKey { get; init; }

    public required string SecretKey { get; init; }

    public required string Bucket { get; init; }

    /// <summary>TLS vs plain HTTP; derived from <c>SEAWEED_S3_SECURE</c> or an <c>https://</c> endpoint.</summary>
    public required bool Secure { get; init; }

    /// <summary>Path-style addressing (required by SeaweedFS/minio-style stores).</summary>
    public required bool ForcePathStyle { get; init; }

    /// <summary>Signing region; SeaweedFS ignores it but SigV4 needs some value.</summary>
    public required string Region { get; init; }

    /// <summary>TTL of pre-signed upload (PUT) URLs.</summary>
    public required int UploadUrlTtlMinutes { get; init; }

    /// <summary>TTL of pre-signed download (GET) URLs handed to clients.</summary>
    public required int DownloadUrlTtlMinutes { get; init; }

    /// <summary>
    /// Signing algorithm version. "4" (SigV4) is required by every current
    /// provider; the AWS SDK still defaults to the retired SigV2.
    /// </summary>
    public required string SignatureVersion { get; init; }

    /// <summary>
    /// Whether the browser may upload straight to storage with a pre-signed URL.
    /// Some providers (Oracle Object Storage) only accept the AWS chunked
    /// streaming format, which a browser cannot produce — then the bytes go
    /// through the service instead.
    /// </summary>
    public required bool DirectUpload { get; init; }

    /// <summary>
    /// Whether writes must carry <c>Content-Encoding: aws-chunked</c>.
    /// Oracle Object Storage rejects a plain streaming upload without it.
    /// </summary>
    public required bool AwsChunked { get; init; }

    public static SeaweedS3Options Load()
    {
        var endpoint = ConnectlyEnv.Get("SEAWEED_S3_ENDPOINT", "http://localhost:8333");
        return new SeaweedS3Options
        {
            Endpoint = endpoint,
            AccessKey = ConnectlyEnv.Get("SEAWEED_S3_ACCESS_KEY", "connectly"),
            SecretKey = ConnectlyEnv.Get("SEAWEED_S3_SECRET_KEY", "connectly_dev_password"),
            Bucket = ConnectlyEnv.Get("SEAWEED_S3_BUCKET", "connectly"),
            Secure = ConnectlyEnv.GetBool("SEAWEED_S3_SECURE", false)
                     || endpoint.StartsWith("https", StringComparison.OrdinalIgnoreCase),
            ForcePathStyle = ConnectlyEnv.GetBool("SEAWEED_S3_FORCE_PATH_STYLE", true),
            Region = ConnectlyEnv.Get("SEAWEED_S3_REGION", "us-east-1"),
            UploadUrlTtlMinutes = ConnectlyEnv.GetInt("SEAWEED_S3_UPLOAD_URL_TTL_MINUTES", 15),
            DownloadUrlTtlMinutes = ConnectlyEnv.GetInt("SEAWEED_S3_DOWNLOAD_URL_TTL_MINUTES", 60),
            SignatureVersion = ConnectlyEnv.Get("SEAWEED_S3_SIGNATURE_VERSION", "4"),
            DirectUpload = ConnectlyEnv.GetBool("SEAWEED_S3_DIRECT_UPLOAD", true),
            AwsChunked = ConnectlyEnv.GetBool("SEAWEED_S3_AWS_CHUNKED", false)
        };
    }
}
