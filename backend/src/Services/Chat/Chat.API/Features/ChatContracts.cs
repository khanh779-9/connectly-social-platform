namespace Chat.Features;

/// <summary>The people of a conversation.</summary>
public sealed record MemberDto(Guid UserId, string Role, DateTimeOffset? LastReadAt, bool Online);

/// <summary>A file that was sent along with a message.</summary>
public sealed record AttachmentDto(Guid Id, string FileName, string ContentType, long SizeBytes, string Url);

/// <summary>One emoji group on a message (emoji + count + whether the viewer is in it).</summary>
public sealed record MessageReactionDto(string ReactionType, int Count, bool ViewerReacted);

/// <summary>Quote of the message a reply points at.</summary>
public sealed record MessageReplyDto(Guid MessageId, Guid SenderUserId, string? Preview, string Status);

public sealed record MessageDto(
    Guid Id,
    Guid ConversationId,
    Guid SenderUserId,
    string? Body,
    string Status,
    DateTimeOffset SentAt,
    List<AttachmentDto> Attachments,
    DateTimeOffset? EditedAt = null,
    List<MessageReactionDto>? Reactions = null,
    MessageReplyDto? ReplyTo = null);

public sealed record ConversationDto(
    Guid Id,
    string Type,
    string? Title,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    List<MemberDto> Members,
    DateTimeOffset? LastMessageAt = null,
    string? LastMessagePreview = null,
    Guid? LastMessageSenderUserId = null,
    int UnreadCount = 0);

public sealed record CreateConversationRequest(string Type, string? Title, List<Guid> MemberUserIds);

public sealed record SendMessageRequest(string? Body, List<CreateAttachmentRequest> Attachments, Guid? ReplyToMessageId = null);

public sealed record CreateAttachmentRequest(string FileName, string ContentType, long SizeBytes, Guid MediaId);

public sealed record EditMessageRequest(string Body);

/// <summary>The ticket the client uses to upload a file into the conversation.</summary>
public sealed record AttachmentUploadTicket(Guid MediaId, string ObjectKey, string UploadUrl);
