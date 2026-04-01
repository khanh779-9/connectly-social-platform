namespace BuildingBlocks.Storage;

public enum MediaKind
{
    Unknown = 0,
    PersonAvatar,
    PersonCover,
    PersonImage,
    PersonVideo,
    PersonStory,
    PostMedia,
    ChatFile
}

/// <summary>
/// [stora] object layout (bucket root = e.g. `connectly`):
///
///   connectly/
///   ├── social-data/
///   │   ├── persons/{userId}/avatar/{yyyy}/{mm}/{uuid}-{file}
///   │   ├── persons/{userId}/cover/{yyyy}/{mm}/{uuid}-{file}
///   │   ├── persons/{userId}/images/{yyyy}/{mm}/{uuid}-{file}
///   │   ├── persons/{userId}/videos/{yyyy}/{mm}/{uuid}-{file}
///   │   ├── persons/{userId}/stories/{yyyy}/{mm}/{uuid}-{file}
///   │   └── posts/{postId}/{yyyy}/{mm}/{uuid}-{file}
///   └── chat-data/{conversationId}/{yyyy}/{mm}/{uuid}-{file}
///
/// Each upload gets a timestamp + uuid segment to avoid collisions and hot directories.
/// </summary>
public static class StoraLayout
{
    public static string PersonObjectKey(Guid userId, MediaKind kind, string originalFileName)
    {
        var (folder, def) = PersonFolder(kind);
        var now = DateTime.UtcNow;
        return $"social-data/persons/{userId}/{folder}/{now:yyyy}/{now:MM}/{NewObjectName(originalFileName, def)}";
    }

    public static string PostObjectKey(string originalFileName)
    {
        // The postId is not known at upload time; heap by time instead of by post (attachments
        // are linked to posts via `post_media` rows in Social DB, not by path).
        var now = DateTime.UtcNow;
        return $"social-data/posts/{now:yyyy}/{now:MM}/{NewObjectName(originalFileName)}";
    }

    public static string ChatObjectKey(Guid conversationId, string originalFileName)
    {
        var now = DateTime.UtcNow;
        return $"chat-data/{conversationId}/{now:yyyy}/{now:MM}/{NewObjectName(originalFileName)}";
    }

    internal static string NewObjectName(string originalFileName, string? prefix = null)
    {
        var (ext, contentType) = ContentFor(originalFileName);
        var name = string.IsNullOrEmpty(prefix) ? $"{Guid.NewGuid()}{ext}" : $"{prefix}-{Guid.NewGuid()}{ext}";
        return name;
    }

    public static (string folder, string? prefix) PersonFolder(MediaKind kind) => kind switch
    {
        MediaKind.PersonAvatar => ("avatar", "avatar"),
        MediaKind.PersonCover => ("cover", "cover"),
        MediaKind.PersonImage => ("images", null),
        MediaKind.PersonVideo => ("videos", null),
        MediaKind.PersonStory => ("stories", null),
        _ => ("other", null)
    };

    public static (string ext, string contentType) ContentFor(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext switch
        {
            ".png" => (ext, "image/png"),
            ".jpg" or ".jpeg" => (ext, "image/jpeg"),
            ".gif" => (ext, "image/gif"),
            ".webp" => (ext, "image/webp"),
            ".mp4" => (ext, "video/mp4"),
            ".webm" => (ext, "video/webm"),
            ".pdf" => (ext, "application/pdf"),
            ".zip" => (ext, "application/zip"),
            ".txt" => (ext, "text/plain"),
            ".json" => (ext, "application/json"),
            _ => (string.IsNullOrEmpty(ext) ? ".bin" : ext, "application/octet-stream")
        };
    }

    /// <summary>
    /// MIME types a client may upload. The list is explicit on purpose: the storage origin
    /// serves the object back with the stored content type, so an accepted type must never
    /// be rendered as an executable document (text/html, image/svg+xml, ...).
    /// </summary>
    public static readonly string[] AllowedUploadContentTypes =
    [
        "image/png", "image/jpeg", "image/gif", "image/webp",
        "video/mp4", "video/webm",
        "application/pdf", "application/zip", "application/json", "text/plain"
    ];

    /// <summary>MIME types that may be attached to a post, story, reel, avatar or cover.</summary>
    public static readonly string[] AllowedMediaContentTypes =
    [
        "image/png", "image/jpeg", "image/gif", "image/webp",
        "video/mp4", "video/webm"
    ];

    /// <summary>Strips parameters ("; charset=...") and lower-cases the type.</summary>
    public static string NormalizeContentType(string? contentType) =>
        (contentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();

    public static bool IsAllowedUploadContentType(string? contentType) =>
        AllowedUploadContentTypes.Contains(NormalizeContentType(contentType));

    public static bool IsAllowedMediaContentType(string? contentType) =>
        AllowedMediaContentTypes.Contains(NormalizeContentType(contentType));

    /// <summary>
    /// Reverse of <see cref="ContentFor(string)"/>: the stored object keeps an extension that
    /// matches its MIME type, so files are not all saved as `.bin`.
    /// </summary>
    public static string ExtensionForContentType(string? contentType) =>
        (contentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant() switch
        {
            "image/png" => ".png",
            "image/jpeg" or "image/jpg" => ".jpg",
            "image/gif" => ".gif",
            "image/webp" => ".webp",
            "video/mp4" => ".mp4",
            "video/webm" => ".webm",
            "application/pdf" => ".pdf",
            "application/zip" => ".zip",
            "text/plain" => ".txt",
            "application/json" => ".json",
            _ => ".bin"
        };
}

