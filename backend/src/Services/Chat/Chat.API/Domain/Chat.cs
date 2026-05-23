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

