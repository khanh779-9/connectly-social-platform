namespace Connectly.Contracts.Events.Chat;

public sealed record MessageSentV1(Guid MessageId, Guid ConversationId, Guid SenderUserId, bool HasAttachments, DateTimeOffset SentAt);

public sealed record ConversationCreatedV1(Guid ConversationId, bool IsGroup, System.Collections.Generic.IReadOnlyList<Guid> MemberUserIds);
