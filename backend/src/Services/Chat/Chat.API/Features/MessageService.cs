using BuildingBlocks.Auth;
using BuildingBlocks.Messaging;
using BuildingBlocks.Pagination;
using BuildingBlocks.Storage;
using Chat.Domain;
using Chat.Persistence;
using Chat.Realtime;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Chat;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Chat.Features;

/// <summary>
/// The messages of a conversation: sending them, reading them, editing them,
/// unsending them and reacting to them.
/// </summary>
public class MessageService(
    ChatDbContext db,
    ICurrentUser currentUser,
    IFileStorage storage,
    IHubContext<ConnectlyChatHub> hub,
    ChatGuard guard,
    ILogger<MessageService> logger)
{
    public const string Producer = "connectly-chat";

    private Guid Me => currentUser.RequireUserId();

    // ---------- send ----------

    public async Task<(MessageDto message, Conversation conversation)> SendMessageAsync(
        Guid conversationId, SendMessageRequest request, CancellationToken ct)
    {
        var conversation = await db.Conversations.Include(c => c.Members)
            .SingleOrDefaultAsync(c => c.Id == conversationId, ct)
            ?? throw new KeyNotFoundException("Conversation not found.");

        if (conversation.Members.All(m => m.UserId != Me))
            throw new UnauthorizedAccessException("Not a member of this conversation.");
        if (string.IsNullOrWhiteSpace(request.Body) && (request.Attachments?.Count ?? 0) == 0)
            throw new ArgumentException("Message is empty.");

        // A block ends the conversation for both sides — in DMs and in group chats alike.
        var otherIds = conversation.Members.Where(m => m.UserId != Me).Select(m => m.UserId).ToList();
        if (await guard.IsBlockedWithAnyAsync(otherIds, ct))
            throw new InvalidOperationException("This conversation is unavailable due to a block.");

        var message = new Message
        {
            ConversationId = conversationId,
            SenderUserId = Me,
            Body = request.Body,
            SentAt = DateTimeOffset.UtcNow
        };

        // reply/quote: the referenced message must live in the same conversation
        Message? quotedMessage = null;
        if (request.ReplyToMessageId is { } replyToId)
        {
            quotedMessage = await db.Messages.AsNoTracking()
                .Include(m => m.Attachments)
                .SingleOrDefaultAsync(m => m.Id == replyToId && m.ConversationId == conversationId, ct)
                ?? throw new ArgumentException("The message you are replying to does not exist.");
            message.ReplyToMessageId = quotedMessage.Id;
        }

        var attachmentEntities = new List<MessageAttachment>();
        if (request.Attachments is { Count: > 0 })
        {
            foreach (var attachment in request.Attachments)
            {
                // attachments must have been uploaded to stora by the client with tickets issued below
                attachmentEntities.Add(new MessageAttachment
                {
                    MessageId = message.Id,
                    ObjectKey = BuildChatKey(conversationId, attachment.MediaId, attachment.FileName),
                    ContentType = attachment.ContentType,
                    SizeBytes = attachment.SizeBytes,
                    FileName = attachment.FileName
                });
            }
        }

        db.Messages.Add(message);
        foreach (var item in attachmentEntities) db.MessageAttachments.Add(item);

        db.EnqueueEvent(EventTypes.Chat.MessageSent,
            new MessageSentV1(message.Id, conversationId, Me, attachmentEntities.Count > 0, message.SentAt), Producer);
        await db.SaveChangesAsync(ct);

        var replied = quotedMessage is null
            ? null
            : new Dictionary<Guid, Message> { [quotedMessage.Id] = quotedMessage };
        var dto = await ToMessageDtoAsync(message, replied, ct);

        logger.LogInformation("Message {MessageId} sent to conversation {ConversationId}", message.Id, conversationId);
        return (dto, conversation);
    }

    /// <summary>
    /// Object key of a chat attachment. The media id is a GUID, so the bucket stays
    /// evenly distributed without a date folder — and, unlike a date folder, the
    /// key is identical when the upload ticket is issued and when the message that
    /// references it is finally sent.
    /// </summary>
    private static string BuildChatKey(Guid conversationId, Guid mediaId, string fileName)
    {
        var (ext, _) = StoraLayout.ContentFor(fileName);
        return $"chat-data/{conversationId}/{mediaId}{ext}";
    }

    public async Task<AttachmentUploadTicket> CreateAttachmentTicketAsync(
        Guid conversationId, string fileName, string contentType, CancellationToken ct)
    {
        var conversation = await db.Conversations.AsNoTracking().Include(c => c.Members)
            .SingleOrDefaultAsync(c => c.Id == conversationId, ct)
            ?? throw new KeyNotFoundException("Conversation not found.");
        if (conversation.Members.All(m => m.UserId != Me))
            throw new UnauthorizedAccessException("Not a member of this conversation.");

        // the content type is signed into the upload URL and the object is served back
        // with it, so only inert types are accepted (never text/html).
        if (!StoraLayout.IsAllowedUploadContentType(contentType))
            throw new ArgumentException($"ContentType must be one of: {string.Join(", ", StoraLayout.AllowedUploadContentTypes)}.");

        // Issue one media id and embed the SAME id in the object key, so the client can
        // reference it in SendMessageRequest and BuildChatKey rebuilds the exact path.
        var mediaId = Guid.NewGuid();
        var objectKey = BuildChatKey(conversationId, mediaId, fileName);
        var url = await storage.GenerateUploadUrlAsync(objectKey, contentType, ct: ct);
        return new AttachmentUploadTicket(mediaId, objectKey, url);
    }

    // ---------- read ----------

    public async Task<CursorPageOf<MessageDto>> GetMessagesAsync(
        Guid conversationId, string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 50);

        var conversation = await db.Conversations.AsNoTracking().Include(c => c.Members)
            .SingleOrDefaultAsync(c => c.Id == conversationId, ct)
            ?? throw new KeyNotFoundException("Conversation not found.");
        if (conversation.Members.All(m => m.UserId != Me))
            throw new UnauthorizedAccessException("Not a member of this conversation.");

        // unsent messages stay in the timeline as a "removed" placeholder;
        // messages the viewer hid for themselves are gone from their timeline only.
        var hiddenIds = db.HiddenMessages.AsNoTracking()
            .Where(h => h.UserId == Me)
            .Select(h => h.MessageId);

        IQueryable<Message> query = db.Messages.AsNoTracking()
            .Include(m => m.Attachments)
            .Include(m => m.Reactions)
            .Where(m => m.ConversationId == conversationId && !hiddenIds.Contains(m.Id))
            .OrderByDescending(m => m.SentAt).ThenByDescending(m => m.Id);

        // the cursor points at the newest message of the previous page: the next page
        // continues with the messages below it
        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(m => m.SentAt < time || (m.SentAt == time && m.Id.CompareTo(id) < 0));
        }

        var items = await query.Take(limit + 1).ToListAsync(ct);
        var page = items.Take(limit).ToList();

        // load the quoted messages of the replies in one query (no N+1)
        var replyIds = page.Where(m => m.ReplyToMessageId is not null)
            .Select(m => m.ReplyToMessageId!.Value)
            .Distinct()
            .ToList();
        var replied = await db.Messages.AsNoTracking()
            .Where(m => replyIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var result = new List<MessageDto>();
        foreach (var message in page) result.Add(await ToMessageDtoAsync(message, replied, ct));

        var nextCursor = items.Count > limit ? Cursor.Encode(items[limit - 1].SentAt, items[limit - 1].Id) : null;
        return new CursorPageOf<MessageDto>(result, nextCursor);
    }

    /// <summary>Marks the conversation as read and tells the other members over SignalR.</summary>
    public async Task MarkReadAsync(Guid conversationId, CancellationToken ct)
    {
        var member = await db.ConversationMembers
            .SingleOrDefaultAsync(m => m.ConversationId == conversationId && m.UserId == Me, ct)
            ?? throw new UnauthorizedAccessException("Not a member of this conversation.");

        member.LastReadAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        await hub.Clients.Group($"conversation:{conversationId}")
            .SendAsync("message-read", new { conversationId, userId = Me, readAt = member.LastReadAt }, ct);
    }

    // ---------- edit / unsend / hide ----------

    /// <summary>How long after sending a message it can still be edited.</summary>
    private static int EditWindowMinutes => BuildingBlocks.Env.ConnectlyEnv.GetInt("CHAT_EDIT_WINDOW_MINUTES", 15);

    /// <summary>
    /// How long after sending a message it can still be unsent for everyone.
    /// Zero (the default) means no limit: the sender may recall a message at any time.
    /// </summary>
    private static int UnsendWindowMinutes => BuildingBlocks.Env.ConnectlyEnv.GetInt("CHAT_UNSEND_WINDOW_MINUTES", 0);

    /// <summary>
    /// Edits the body of a message. Only the sender may edit, only inside the
    /// edit window and never after the message was unsent.
    /// </summary>
    public async Task<MessageDto> EditMessageAsync(Guid messageId, EditMessageRequest request, CancellationToken ct)
    {
        var body = request.Body?.Trim();
        if (string.IsNullOrWhiteSpace(body)) throw new ArgumentException("The message cannot be empty.");
        if (body.Length > 8000) throw new ArgumentException("The message is too long.");

        var message = await db.Messages.Include(m => m.Attachments).Include(m => m.Reactions)
            .SingleOrDefaultAsync(m => m.Id == messageId, ct)
            ?? throw new KeyNotFoundException("Message not found.");
        if (message.SenderUserId != Me) throw new UnauthorizedAccessException("You can only edit your own messages.");
        if (message.Status == "deleted") throw new InvalidOperationException("This message was removed.");
        if (message.SentAt < DateTimeOffset.UtcNow.AddMinutes(-EditWindowMinutes))
            throw new InvalidOperationException("The edit window for this message has expired.");

        message.Body = body;
        message.EditedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        IReadOnlyDictionary<Guid, Message>? replied = null;
        if (message.ReplyToMessageId is { } quotedId)
        {
            var quoted = await db.Messages.AsNoTracking()
                .Include(m => m.Attachments)
                .SingleOrDefaultAsync(m => m.Id == quotedId, ct);
            if (quoted is not null) replied = new Dictionary<Guid, Message> { [quoted.Id] = quoted };
        }

        var dto = await ToMessageDtoAsync(message, replied, ct);
        await PushMessageUpdatedAsync(message.ConversationId, dto, ct);
        return dto;
    }

    /// <summary>
    /// Unsend a message for everyone: the body and attachments are cleared, the
    /// message stays in the timeline as a "removed" placeholder and every
    /// reaction/attachment is dropped. The sender may recall a message at any
    /// time — the window is configurable but unlimited by default.
    /// </summary>
    public async Task DeleteMessageAsync(Guid messageId, CancellationToken ct)
    {
        var message = await db.Messages.Include(m => m.Reactions).Include(m => m.Attachments)
            .SingleOrDefaultAsync(m => m.Id == messageId, ct)
            ?? throw new KeyNotFoundException("Message not found.");
        if (message.SenderUserId != Me) throw new UnauthorizedAccessException("You can only remove your own messages.");
        if (message.Status == "deleted") return; // idempotent
        if (UnsendWindowMinutes > 0 && message.SentAt < DateTimeOffset.UtcNow.AddMinutes(-UnsendWindowMinutes))
            throw new InvalidOperationException("The unsend window for this message has expired.");

        message.Status = "deleted";
        message.Body = null;
        message.DeletedAt = DateTimeOffset.UtcNow;

        // reactions of a removed message are invalidated together with it
        if (message.Reactions.Count > 0)
        {
            db.MessageReactions.RemoveRange(message.Reactions);
            message.Reactions.Clear();
        }

        // attachments are removed together with the message body
        if (message.Attachments.Count > 0)
        {
            db.MessageAttachments.RemoveRange(message.Attachments);
            foreach (var attachment in message.Attachments)
            {
                try { await storage.DeleteObjectAsync(attachment.ObjectKey, ct); }
                catch { /* the row removal is what matters; orphan objects are harmless */ }
            }
            message.Attachments.Clear();
        }

        await db.SaveChangesAsync(ct);
        await PushMessageDeletedAsync(message.ConversationId, message.Id, message.DeletedAt.Value, ct);
    }

    /// <summary>
    /// Hides a message for the viewer only ("delete for me"). The message stays
    /// untouched for everybody else; the viewer simply stops seeing it in their
    /// own timeline. Idempotent, and never broadcast over SignalR.
    /// </summary>
    public async Task HideMessageAsync(Guid messageId, CancellationToken ct)
    {
        var message = await db.Messages.AsNoTracking()
            .SingleOrDefaultAsync(m => m.Id == messageId, ct)
            ?? throw new KeyNotFoundException("Message not found.");

        var hidden = await db.HiddenMessages.FindAsync([messageId, Me]);
        if (hidden is null)
        {
            db.HiddenMessages.Add(new MessageHiddenForUser
            {
                MessageId = messageId,
                UserId = Me,
                HiddenAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync(ct);
        }
    }

    // ---------- reactions ----------

    /// <summary>
    /// Adds an emoji reaction. One user may add one reaction per emoji per
    /// message; adding the same emoji twice is a no-op.
    /// </summary>
    public async Task<MessageReactionDto> SetMessageReactionAsync(
        Guid messageId, string reactionType, CancellationToken ct)
    {
        var emoji = NormalizeReaction(reactionType);
        var message = await db.Messages.Include(m => m.Reactions)
            .SingleOrDefaultAsync(m => m.Id == messageId, ct)
            ?? throw new KeyNotFoundException("Message not found.");
        if (message.Status == "deleted") throw new InvalidOperationException("This message was removed.");
        await guard.EnsureMemberAsync(message.ConversationId, ct);

        var existing = message.Reactions.FirstOrDefault(r => r.UserId == Me && r.ReactionType == emoji);
        if (existing is null)
        {
            var reaction = new MessageReaction
            {
                MessageId = messageId,
                UserId = Me,
                ReactionType = emoji,
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.MessageReactions.Add(reaction);
            message.Reactions.Add(reaction);
            await db.SaveChangesAsync(ct);
        }

        var dto = BuildReactionDto(message.Reactions, emoji);
        await PushMessageReactionAsync(message.ConversationId, messageId, emoji, Me, true, ct);
        return dto;
    }

    /// <summary>Removes one emoji reaction of the viewer.</summary>
    public async Task<MessageReactionDto> RemoveMessageReactionAsync(
        Guid messageId, string reactionType, CancellationToken ct)
    {
        var emoji = NormalizeReaction(reactionType);
        var message = await db.Messages.Include(m => m.Reactions)
            .SingleOrDefaultAsync(m => m.Id == messageId, ct)
            ?? throw new KeyNotFoundException("Message not found.");
        await guard.EnsureMemberAsync(message.ConversationId, ct);

        var existing = message.Reactions.FirstOrDefault(r => r.UserId == Me && r.ReactionType == emoji);
        if (existing is not null)
        {
            db.MessageReactions.Remove(existing);
            message.Reactions.Remove(existing);
            await db.SaveChangesAsync(ct);
        }

        var dto = BuildReactionDto(message.Reactions, emoji);
        await PushMessageReactionAsync(message.ConversationId, messageId, emoji, Me, false, ct);
        return dto;
    }

    /// <summary>Normalizes the emoji key: trimmed, max 16 chars, no control characters.</summary>
    private static string NormalizeReaction(string reactionType)
    {
        var emoji = (reactionType ?? string.Empty).Trim();
        if (emoji.Length == 0) throw new ArgumentException("Pick a reaction.");
        if (emoji.Length > 16) throw new ArgumentException("The reaction is too long.");
        if (emoji.Any(char.IsControl)) throw new ArgumentException("The reaction is not valid.");
        return emoji;
    }

    private MessageReactionDto BuildReactionDto(IEnumerable<MessageReaction> reactions, string emoji)
    {
        var group = reactions.Where(r => r.ReactionType == emoji).ToList();
        return new MessageReactionDto(emoji, group.Count, group.Any(r => r.UserId == Me));
    }

    // ---------- push over SignalR ----------

    /// <summary>Sends a new message to the members of the conversation.</summary>
    public async Task PushMessageAsync(Guid conversationId, MessageDto message, CancellationToken ct)
    {
        var conversation = await db.Conversations.AsNoTracking().Include(c => c.Members)
            .SingleOrDefaultAsync(c => c.Id == conversationId, ct);
        if (conversation is null) return;

        var groups = conversation.Members.Select(m => $"user:{m.UserId}").ToArray();
        await hub.Clients.Groups(groups).SendAsync("message-received", message, ct);
    }

    /// <summary>Notifies the conversation members that a message was edited.</summary>
    public async Task PushMessageUpdatedAsync(Guid conversationId, MessageDto message, CancellationToken ct)
    {
        await hub.Clients.Group($"conversation:{conversationId}").SendAsync("message-updated", message, ct);
    }

    /// <summary>Notifies the conversation members that a message was unsent.</summary>
    public async Task PushMessageDeletedAsync(Guid conversationId, Guid messageId, DateTimeOffset deletedAt, CancellationToken ct)
    {
        await hub.Clients.Group($"conversation:{conversationId}")
            .SendAsync("message-deleted", new { conversationId, messageId, deletedAt }, ct);
    }

    /// <summary>Notifies the conversation members about a reaction change.</summary>
    public async Task PushMessageReactionAsync(
        Guid conversationId, Guid messageId, string reactionType, Guid userId, bool active, CancellationToken ct)
    {
        await hub.Clients.Group($"conversation:{conversationId}")
            .SendAsync("message-reaction", new { conversationId, messageId, reactionType, userId, active }, ct);
    }

    // ---------- mapping to the DTO ----------

    private async Task<MessageDto> ToMessageDtoAsync(
        Message message, IReadOnlyDictionary<Guid, Message>? replied, CancellationToken ct)
    {
        var attachments = new List<AttachmentDto>();
        foreach (var attachment in message.Attachments)
        {
            var url = await storage.GenerateDownloadUrlAsync(attachment.ObjectKey, ct: ct);
            attachments.Add(new AttachmentDto(
                attachment.Id, attachment.FileName, attachment.ContentType, attachment.SizeBytes, url));
        }

        // reaction groups: emoji + count + whether the viewer is in the group
        var reactions = message.Reactions
            .GroupBy(r => r.ReactionType)
            .Select(g => new MessageReactionDto(g.Key, g.Count(), g.Any(r => r.UserId == Me)))
            .OrderByDescending(r => r.Count)
            .ToList();

        MessageReplyDto? reply = null;
        if (message.ReplyToMessageId is { } replyId
            && replied is not null
            && replied.TryGetValue(replyId, out var quoted))
        {
            reply = new MessageReplyDto(quoted.Id, quoted.SenderUserId, QuotedPreview(quoted), quoted.Status);
        }

        return new MessageDto(
            message.Id,
            message.ConversationId,
            message.SenderUserId,
            message.Body,
            message.Status,
            message.SentAt,
            attachments,
            message.EditedAt,
            reactions,
            reply);
    }

    /// <summary>Short preview of a quoted message (removed messages lose their body).</summary>
    private static string? QuotedPreview(Message message)
    {
        if (message.Status == "deleted") return "Message removed";
        if (!string.IsNullOrWhiteSpace(message.Body))
            return message.Body.Length > 120 ? message.Body[..120] + "…" : message.Body;
        return message.Attachments.Count > 0 ? "Sent an attachment" : null;
    }
}
