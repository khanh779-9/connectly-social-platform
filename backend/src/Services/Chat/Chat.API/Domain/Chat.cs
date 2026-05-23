namespace Chat.Domain;

public class Conversation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    /// <summary>dm | group</summary>
    public string Type { get; set; } = "dm";
    public string? Title { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<ConversationMember> Members { get; set; } = new List<ConversationMember>();
}

public class ConversationMember
{
    public Guid ConversationId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset JoinedAt { get; set; }
    /// <summary>one-by-one chat = "member"; group = member/admin</summary>
    public string Role { get; set; } = "member";
    public DateTimeOffset? LastReadAt { get; set; }
    public DateTimeOffset? LastAckedMessageAt { get; set; }

    public Conversation? Conversation { get; set; }
}

public class Message
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ConversationId { get; set; }
    public Guid SenderUserId { get; set; }
    public string? Body { get; set; }
    /// <summary>sent | deleted</summary>
    public string Status { get; set; } = "sent";
    public DateTimeOffset SentAt { get; set; }
    public DateTimeOffset? EditedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    /// <summary>The message this one replies to (quote).</summary>
    public Guid? ReplyToMessageId { get; set; }

    public Message? ReplyToMessage { get; set; }
    public ICollection<MessageAttachment> Attachments { get; set; } = new List<MessageAttachment>();
    public ICollection<MessageReaction> Reactions { get; set; } = new List<MessageReaction>();
}

/// <summary>
/// An emoji reaction on a message (composite PK: message_id + user_id + reaction_type).
/// One user may add one reaction per emoji per message, and a message can carry
/// several emoji groups at the same time.
/// </summary>
public class MessageReaction
{
    public Guid MessageId { get; set; }
    public Guid UserId { get; set; }
    /// <summary>The emoji itself, e.g. "👍".</summary>
    public string ReactionType { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; }

    public Message? Message { get; set; }
}

/// <summary>
/// A message hidden for one viewer only ("delete for me"). The row keeps the
/// message in the conversation for everybody else, and the viewer simply does
/// not see it in their own timeline any more.
/// </summary>
public class MessageHiddenForUser
{
    public Guid MessageId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset HiddenAt { get; set; }

    public Message? Message { get; set; }
}

/// <summary>File attachment in [stora] — chat-data/{conversationId}/{yyyy}/{mm}/…</summary>
public class MessageAttachment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MessageId { get; set; }
    public string ObjectKey { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long SizeBytes { get; set; }
    public string FileName { get; set; } = default!;
    public Message? Message { get; set; }
}

/// <summary>Projection maintained by consuming social.blocked.v1 — Chat never queries the Social DB.</summary>
public class BlockedPairProjection
{
    public Guid BlockerId { get; set; }
    public Guid BlockedUserId { get; set; }
    public DateTimeOffset BlockedAt { get; set; }
}

/// <summary>Per-user chat preferences (one row per user), edited from the settings page.</summary>
public class ChatUserSettings
{
    public Guid UserId { get; set; }
    /// <summary>everyone | friends | nobody — who may start a new conversation with this user.</summary>
    public string MessagePrivacy { get; set; } = "everyone";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

