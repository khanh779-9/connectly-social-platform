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

