namespace Connectly.Contracts.EventTypes;

/// <summary>
/// Canonical event type identifiers (exchange routing keys).
/// Convention: {domain}.{event-name}.v{version}
/// </summary>
public static class EventTypes
{
    public static class Identity
    {
        public const string UserRegistered = "identity.user-registered.v1";
    }

    public static class Social
    {
        public const string FriendRequestCreated = "social.friend-request-created.v1";
        public const string FriendshipAccepted = "social.friendship-accepted.v1";
        public const string Followed = "social.user-followed.v1";
        public const string Blocked = "social.user-blocked.v1";
        public const string Unblocked = "social.user-unblocked.v1";
        public const string PostPublished = "social.post-published.v1";
        public const string PostDeleted = "social.post-deleted.v1";
        public const string CommentCreated = "social.comment-created.v1";
        public const string ReactionChanged = "social.reaction-changed.v1";
        public const string PostShared = "social.post-shared.v1";
        public const string GroupJoinRequested = "social.group-join-requested.v1";
        public const string GroupMemberJoined = "social.group-member-joined.v1";
        public const string PollVoted = "social.poll-voted.v1";
        public const string StoryViewed = "social.story-viewed.v1";
        public const string UserMentioned = "social.user-mentioned.v1";
    }

    public static class Chat
    {
        public const string MessageSent = "chat.message-sent.v1";
        public const string ConversationCreated = "chat.conversation-created.v1";
    }
}
