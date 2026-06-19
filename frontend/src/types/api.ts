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

