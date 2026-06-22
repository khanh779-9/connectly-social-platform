// Backend DTO types (camelCase JSON from ASP.NET Core)

export interface ProfileDto {
  userId: string;
  displayName: string;
  /** unique @handle used by mentions (null when the user has not set one) */
  username?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  website?: string | null;
  locationText?: string | null;
  contactEmail?: string | null;
  /** yyyy-MM-dd; null when the viewer is not allowed to see it. */
  dateOfBirth?: string | null;
  phoneNumber?: string | null;
  city?: string | null;
  hometown?: string | null;
  joinedAt?: string | null;
}

/** Who is allowed to see one piece of profile information. */
export type ProfileAudience = 'everyone' | 'friends' | 'friends_of_friends' | 'only_me';

export type PostVisibilitySetting = 'public' | 'friends' | 'only_me';

export type FriendRequestPolicy = 'everyone' | 'friends_of_friends';

/** Saved privacy preferences; the server applies them when it builds a profile for a viewer. */
export interface PrivacySettingsDto {
  defaultPostVisibility: PostVisibilitySetting;
  friendRequestPolicy: FriendRequestPolicy;
  avatarAudience: ProfileAudience;
  coverAudience: ProfileAudience;
  bioAudience: ProfileAudience;
  websiteAudience: ProfileAudience;
  locationAudience: ProfileAudience;
  emailAudience: ProfileAudience;
  birthdayAudience: ProfileAudience;
  phoneAudience: ProfileAudience;
  cityAudience: ProfileAudience;
  hometownAudience: ProfileAudience;
  friendListAudience: ProfileAudience;
  followingAudience: ProfileAudience;
  followersAudience: ProfileAudience;
  commentAudience: ProfileAudience;
  searchableAudience: ProfileAudience;
}

/** Who may start a new conversation with the user. */
export type MessagePrivacy = 'everyone' | 'friends' | 'nobody';

export interface ChatSettingsDto {
  messagePrivacy: MessagePrivacy;
}

/** A user tagged with @username inside a post or a comment. */
export interface MentionDto {
  userId: string;
  username: string;
}

export interface PostMediaDto {
  id: string;
  objectKey: string;
  url: string;
  contentType: string;
  sortOrder: number;
}

export interface PollOptionDto {
  id: string;
  text: string;
  voteCount: number;
  viewerVoted: boolean;
}

export interface PollDto {
  postId: string;
  question: string;
  allowMultiple: boolean;
  options: PollOptionDto[];
  totalVotes: number;
}

export interface PostDto {
  id: string;
  authorUserId: string;
  textContent?: string | null;
  /** "Public" | "Friends" | "OnlyMe" (responses carry names, requests carry numbers) */
  visibility: string | number;
  /** "Draft" | "Published" | "Hidden" | "Deleted" */
  status: string | number;
  createdAt: string;
  media: PostMediaDto[];
  reactionCount: number;
  commentCount: number;
  viewerReaction?: string | null;
  viewerBookmarked: boolean;
  /** counts per reaction type, descending (Facebook-style summary) */
  reactionBreakdowns?: { type: string; count: number }[];
  shareCount?: number;
  /** set when the post was published inside a group */
  groupId?: string | null;
  /** present when the post carries a poll */
  poll?: PollDto | null;
  /** set when the post was published on behalf of a page */
  pageId?: string | null;
  /** users tagged with @username in the post body */
  mentions?: MentionDto[];
  /** set once the author has changed the text; drives the "Edited" marker */
  editedAt?: string | null;
}

/** One revision of a post/comment body. */
export interface ContentEditDto {
  editorUserId: string;
  previousText?: string | null;
  newText?: string | null;
  editedAt: string;
}

export interface FeedItemDto {
  post: PostDto;
  source: string;
}

export interface ReactionActorDto {
  userId: string;
  /** "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry" */
  reactionType: string;
  createdAt: string;
}

export interface CommentDto {
  id: string;
  postId: string;
  authorUserId: string;
  parentCommentId?: string | null;
  content: string;
  /** "active" | "deleted" */
  status: string;
  createdAt: string;
  updatedAt: string;
  wasEdited: boolean;
  reactionCount: number;
  viewerReaction?: string | null;
  /** users tagged with @username in the comment body */
  mentions?: MentionDto[];
}

export interface CursorPageOf<T> {
  items: T[];
  nextCursor?: string | null;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export interface GroupDto {
  id: string;
  createdByUserId: string;
  name: string;
  description?: string | null;
  /** "Public" | "Private" */
  visibility: string;
  createdAt: string;
  memberCount: number;
  /** "owner" | "admin" | "moderator" | "member" (null when not a member) */
  viewerRole?: string | null;
  /** "active" | "pending" (pending = join request awaiting approval) */
  viewerStatus?: string | null;
}

export interface GroupMemberDto {
  userId: string;
  /** "owner" | "admin" | "moderator" | "member" */
  role: string;
  /** "active" | "pending" */
  status: string;
  joinedAt: string;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export interface PageDto {
  id: string;
  ownerUserId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  createdAt: string;
  adminCount: number;
  postCount: number;
  /** "owner" | "admin" | "editor" | "moderator" (null when not an admin) */
  viewerRole?: string | null;
}

export interface PageAdminDto {
  userId: string;
  /** "owner" | "admin" | "editor" | "moderator" */
  role: string;
  addedAt: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface EventDto {
  id: string;
  hostUserId: string;
  groupId?: string | null;
  title: string;
  description?: string | null;
  locationText?: string | null;
  onlineUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  createdAt: string;
  goingCount: number;
  interestedCount: number;
  /** "going" | "interested" | null */
  viewerRsvp?: string | null;
}

export interface EventAttendeeDto {
  userId: string;
  /** "going" | "interested" */
  rsvp: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Stories & Highlights
// ---------------------------------------------------------------------------

export interface StoryDto {
  id: string;
  authorUserId: string;
  /** pre-signed media URL (image or video) */
  url: string;
  contentType: string;
  caption?: string | null;
  createdAt: string;
  /** null when the story was archived into a highlight */
  expiresAt?: string | null;
  viewCount: number;
  viewerViewed: boolean;
  /** "Public" | "Friends" | "OnlyMe" */
  visibility?: string;
}

export interface StoryAuthorDto {
  userId: string;
  stories: StoryDto[];
  /** true when at least one story was not seen by the viewer */
  hasUnviewed: boolean;
}

export interface StoryViewDto {
  viewerUserId: string;
  viewedAt: string;
}

export interface HighlightDto {
  id: string;
  ownerUserId: string;
  title: string;
  createdAt: string;
  /** pre-signed URL of the first story in the highlight */
  coverUrl?: string | null;
  storyCount: number;
}

// ---------------------------------------------------------------------------
// Reels
// ---------------------------------------------------------------------------

export interface ReelDto {
  id: string;
  authorUserId: string;
  caption?: string | null;
  /** "Public" | "Friends" | "OnlyMe" */
  visibility: string;
  createdAt: string;
  /** pre-signed URL of the video file */
  url: string;
  contentType: string;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  viewerReaction?: string | null;
  viewerBookmarked: boolean;
  /** qualified views (the reel was watched long enough) */
  viewCount: number;
  /** users tagged with @username in the caption */
  mentions?: MentionDto[];
}

export interface NotificationApiDto {
  id: string;
  type: string;
  actorUserId?: string | null;
  targetPostId?: string | null;
  targetCommentId?: string | null;
  preview?: string | null;
  /** Device description captured for a new sign-in, for example "Chrome on Windows". */
  deviceLabel?: string | null;
  /** IP address observed for a new sign-in. */
  ipAddress?: string | null;
  /** Coarse location observed for a new sign-in. */
  location?: string | null;
  status: string;
  createdAt: string;
  readAt?: string | null;
}

// ---------------------------------------------------------------------------
// Social graph
// ---------------------------------------------------------------------------

export interface RelationshipDto {
  isFriend: boolean;
  isFollowing: boolean;
  hasIncomingRequest: boolean;
  hasOutgoingRequest: boolean;
  isBlocked: boolean;
  isMuted: boolean;
  followerCount: number;
  followingCount: number;
  friendCount: number;
}

export interface FriendRequestDto {
  requestId: string;
  otherUserId: string;
  status: string;
  createdAt: string;
  profile: ProfileDto;
}

export interface FriendRequestResultDto {
  friendRequestId: string;
  requesterUserId: string;
  targetUserId: string;
  status: string;
}

export interface SearchResultDto {
  users: ProfileDto[];
  posts: PostDto[];
  groups: GroupDto[];
  pages: PageDto[];
  events: EventDto[];
  /** hashtags (without the leading #), most used first */
  hashtags: string[];
}

export interface UploadTicketDto {
  mediaId: string;
  uploadUrl: string;
  objectKey: string;
  contentType: string;
  /** False when the provider cannot take a browser upload: the file goes through the service. */
  directUpload: boolean;
}

export interface MeDto {
  userId: string;
  displayName: string;
  email: string;
  status: string;
}

/** Online now, and when the user was last active when they are not. */
export interface PresenceDto {
  online: boolean;
  lastSeenAt?: string | null;
}

/** One device signed in to the account (security settings). */
export interface UserSessionDto {
  id: string;
  deviceLabel?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  location?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  /** true for the browser that requested the list */
  current: boolean;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMemberDto {
  userId: string;
  role: string;
  lastReadAt?: string | null;
  online: boolean;
}

export interface ChatAttachmentDto {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

/** Descriptor of an uploaded file, sent along with a new chat message. */
export interface ChatAttachmentUpload {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  mediaId: string;
}

/** Pre-signed upload ticket handed out by the chat API. */
export interface ChatAttachmentUploadTicket {
  mediaId: string;
  objectKey: string;
  uploadUrl: string;
}

export interface ChatMessageReactionDto {
  reactionType: string;
  count: number;
  viewerReacted: boolean;
}

export interface ChatMessageReplyDto {
  messageId: string;
  senderUserId: string;
  preview?: string | null;
  status: string; // sent | deleted
}

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderUserId: string;
  body?: string | null;
  status: string; // sent | deleted
  sentAt: string;
  attachments: ChatAttachmentDto[];
  editedAt?: string | null;
  reactions?: ChatMessageReactionDto[] | null;
  replyTo?: ChatMessageReplyDto | null;
}

export interface ConversationDto {
  id: string;
  type: string; // dm | group
  title?: string | null;
  createdAt: string;
  updatedAt: string;
  members: ChatMemberDto[];
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  lastMessageSenderUserId?: string | null;
  unreadCount: number;
}
