import axios from 'axios';
import { api, IDENTITY_API } from '@/lib/api';
import type {
  ChatAttachmentUpload,
  ChatAttachmentUploadTicket,
  ChatMessageDto,
  ChatMessageReactionDto,
  CommentDto,
  ConversationDto,
  CursorPageOf,
  EventAttendeeDto,
  EventDto,
  FeedItemDto,
  FriendRequestDto,
  FriendRequestResultDto,
  GroupDto,
  GroupMemberDto,
  HighlightDto,
  MeDto,
  NotificationApiDto,
  PageAdminDto,
  ChatSettingsDto,
  ContentEditDto,
  MessagePrivacy,
  PageDto,
  PollDto,
  PostDto,
  PrivacySettingsDto,
  ProfileDto,
  ReactionActorDto,
  ReelDto,
  RelationshipDto,
  SearchResultDto,
  StoryAuthorDto,
  StoryDto,
  StoryViewDto,
  UploadTicketDto,
} from '@/types/api';

export const SOCIAL_API = `${import.meta.env.VITE_API_URL}/social/api/v1`;
export const NOTIFICATION_API = `${import.meta.env.VITE_API_URL}/notification/api/v1`;
export const CHAT_API = `${import.meta.env.VITE_API_URL}/chat/api/v1`;

/** Copy a person can act on; provider names, stack traces and status codes stay out of the UI. */
const SERVICE_UNAVAILABLE =
  'This part of Connectly is temporarily unavailable. Please try again in a moment.';
const CANNOT_REACH_SERVER =
  'We cannot reach the server right now. Check your connection and try again.';

export function getErrorMessage(error: unknown): string {
  const httpError = (error as {
    response?: { data?: unknown; status?: number };
  }).response;
  const status = httpError?.status;
  const data = httpError?.data;

  // A 5xx body is usually a server crash with a stack trace. Show a plain
  // sentence instead — a broken dependency is not the user's problem.
  if (typeof status === 'number' && status >= 500) return SERVICE_UNAVAILABLE;

  // No response at all means the request never reached the server.
  if (!httpError) {
    const message = error instanceof Error ? error.message : '';
    // axios says "Network Error" / browsers say "Failed to fetch": neither helps.
    if (message && !/^(network error|failed to fetch|load failed)/i.test(message)) {
      return message;
    }
    return CANNOT_REACH_SERVER;
  }

  if (data && typeof data === 'object') {
    const body = data as { message?: string; detail?: string };
    if (body.message) return body.message;
    if (body.detail) return body.detail;
  }

  // 4xx bodies are written for humans by the API; keep the first line if it is short.
  if (typeof data === 'string' && data.trim()) {
    const firstLine = data.trim().split('\n')[0].trim();
    if (firstLine && firstLine.length <= 240) return firstLine;
  }

  if (status) return 'That request could not be completed. Please try again.';
  return 'Something went wrong. Please try again.';
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function initials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
}

/** Post visibility arrives as a name ("Public", "Friends", "OnlyMe") but older payloads used numbers. */
export function visibilityLabel(visibility: string | number | undefined): string {
  if (visibility === 1 || visibility === '1' || visibility === 'Friends') return 'Friends';
  if (visibility === 2 || visibility === '2' || visibility === 'OnlyMe') return 'Only me';
  return 'Public';
}

/** Numeric value used by request payloads (Public=0, Friends=1, OnlyMe=2). */
export function visibilityValue(visibility: string | number | undefined): number {
  if (visibility === 1 || visibility === '1' || visibility === 'Friends') return 1;
  if (visibility === 2 || visibility === '2' || visibility === 'OnlyMe') return 2;
  return 0;
}

/**
 * Resolves the viewer's reaction for a post. An entry in the local state map
 * wins even when it is `null` (the viewer just removed their reaction); only an
 * absent key falls back to the value the server returned.
 */
export function viewerReactionFrom(
  map: Record<string, string | null>,
  post: { id: string; viewerReaction?: string | null },
): string | null {
  const local = map[post.id];
  return local !== undefined ? local : (post.viewerReaction ?? null);
}

// ---------------------------------------------------------------------------
// Profiles: PostDto only carries authorUserId, so the UI needs to resolve
// display names / avatars separately. A module-level cache keeps repeated
// renders cheap and lets several components share fetched profiles.
// ---------------------------------------------------------------------------

const profileCache = new Map<string, ProfileDto | null>();

export function cachedProfile(userId: string): ProfileDto | null {
  return profileCache.get(userId) ?? null;
}

export function primeProfile(profile: ProfileDto | null): void {
  if (!profile) return;
  profileCache.set(profile.userId, profile);
}

/** Loads the profiles that are not cached yet. */
export async function ensureProfiles(userIds: string[]): Promise<Record<string, ProfileDto | null>> {
  const ids = Array.from(new Set(userIds));
  const missing = ids.filter((id) => !profileCache.has(id));

  await Promise.all(
    missing.map(async (id) => {
      try {
        const response = await api.get<ProfileDto>(`${SOCIAL_API}/profiles/${id}`);
        profileCache.set(id, response.data);
      } catch {
        profileCache.set(id, null);
      }
    }),
  );

  const result: Record<string, ProfileDto | null> = {};
  ids.forEach((id) => {
    result[id] = profileCache.get(id) ?? null;
  });
  return result;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export async function fetchMe(): Promise<MeDto> {
  const response = await api.get<MeDto>(`${IDENTITY_API}/me`);
  return response.data;
}

// ---------------------------------------------------------------------------
// Feed / posts / comments / reactions
// ---------------------------------------------------------------------------

export async function fetchHomeFeed(cursor?: string, limit = 15): Promise<CursorPageOf<FeedItemDto>> {
  const params = { limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<FeedItemDto>>(`${SOCIAL_API}/feed/home`, { params });
  return response.data;
}

export async function createPost(
  textContent: string,
  mediaAssetIds: string[] = [],
  visibility = 0,
  groupId?: string | null,
  poll?: { question: string; options: string[]; allowMultiple?: boolean } | null,
  pageId?: string | null,
): Promise<PostDto> {
  const body = {
    textContent,
    visibility, // PostVisibility enum binds as a number (Public=0, Friends=1, OnlyMe=2)
    mediaAssetIds,
    publishImmediately: true,
    groupId: groupId ?? null,
    poll: poll ? { question: poll.question, options: poll.options, allowMultiple: poll.allowMultiple ?? false } : null,
    pageId: pageId ?? null,
  };
  const response = await api.post<PostDto>(`${SOCIAL_API}/posts`, body);
  return response.data;
}

/** Casts (or replaces) the viewer's poll vote. Pass an empty array to withdraw it. */
export async function votePoll(postId: string, optionIds: string[]): Promise<PollDto> {
  const response = await api.put<PollDto>(`${SOCIAL_API}/posts/${postId}/poll/vote`, { optionIds });
  return response.data;
}

export async function updatePost(
  postId: string,
  payload: { textContent?: string | null; visibility?: number | null },
): Promise<PostDto> {
  const response = await api.patch<PostDto>(`${SOCIAL_API}/posts/${postId}`, payload);
  return response.data;
}

export async function fetchPost(postId: string): Promise<PostDto> {
  const response = await api.get<PostDto>(`${SOCIAL_API}/posts/${postId}`);
  return response.data;
}

/** Revision history of a post; readable by anyone who can read the post. */
export async function fetchPostEdits(postId: string): Promise<ContentEditDto[]> {
  const response = await api.get<ContentEditDto[]>(`${SOCIAL_API}/posts/${postId}/edits`);
  return response.data;
}

/** Revision history of a comment. */
export async function fetchCommentEdits(commentId: string): Promise<ContentEditDto[]> {
  const response = await api.get<ContentEditDto[]>(`${SOCIAL_API}/comments/${commentId}/edits`);
  return response.data;
}

export async function deletePost(postId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/posts/${postId}`);
}

export async function fetchMyProfile(): Promise<ProfileDto> {
  const response = await api.get<ProfileDto>(`${SOCIAL_API}/me/profile`);
  primeProfile(response.data);
  return response.data;
}

export async function fetchProfileById(userId: string): Promise<ProfileDto> {
  const response = await api.get<ProfileDto>(`${SOCIAL_API}/profiles/${userId}`);
  primeProfile(response.data);
  return response.data;
}

/** Privacy preferences (default post audience, who sees each profile field, …). */
export async function fetchPrivacySettings(): Promise<PrivacySettingsDto> {
  const response = await api.get<PrivacySettingsDto>(`${SOCIAL_API}/me/privacy`);
  return response.data;
}

/** Saves only the properties present in the patch and returns the stored settings. */
export async function savePrivacySettings(
  patch: Partial<PrivacySettingsDto>,
): Promise<PrivacySettingsDto> {
  const response = await api.put<PrivacySettingsDto>(`${SOCIAL_API}/me/privacy`, patch);
  return response.data;
}

/** Who is allowed to start a conversation with the signed-in user. */
export async function fetchChatSettings(): Promise<ChatSettingsDto> {
  const response = await api.get<ChatSettingsDto>(`${CHAT_API}/me/chat-settings`);
  return response.data;
}

export async function saveChatSettings(patch: {
  messagePrivacy: MessagePrivacy;
}): Promise<ChatSettingsDto> {
  const response = await api.put<ChatSettingsDto>(`${CHAT_API}/me/chat-settings`, patch);
  return response.data;
}

export async function updateMyProfile(payload: {
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  website?: string | null;
  locationText?: string | null;
  contactEmail?: string | null;
  dateOfBirth?: string | null;
  phoneNumber?: string | null;
  city?: string | null;
  hometown?: string | null;
}): Promise<ProfileDto> {
  const response = await api.patch<ProfileDto>(`${SOCIAL_API}/me/profile`, payload);
  primeProfile(response.data);
  return response.data;
}

export async function fetchFriends(userId: string): Promise<ProfileDto[]> {
  const response = await api.get<ProfileDto[]>(`${SOCIAL_API}/profiles/${userId}/friends`);
  response.data.forEach(primeProfile);
  return response.data;
}

export async function fetchFollowers(userId: string): Promise<ProfileDto[]> {
  const response = await api.get<ProfileDto[]>(`${SOCIAL_API}/profiles/${userId}/followers`);
  response.data.forEach(primeProfile);
  return response.data;
}

export async function fetchFollowing(userId: string): Promise<ProfileDto[]> {
  const response = await api.get<ProfileDto[]>(`${SOCIAL_API}/profiles/${userId}/following`);
  response.data.forEach(primeProfile);
  return response.data;
}

export async function fetchComments(postId: string): Promise<CommentDto[]> {
  const response = await api.get<CursorPageOf<CommentDto>>(
    `${SOCIAL_API}/posts/${postId}/comments`,
    { params: { limit: 50 } },
  );
  return response.data.items;
}

export async function postComment(
  postId: string,
  content: string,
  parentCommentId: string | null = null,
): Promise<CommentDto> {
  const response = await api.post<CommentDto>(`${SOCIAL_API}/posts/${postId}/comments`, {
    content,
    parentCommentId,
  });
  return response.data;
}

export async function updateComment(commentId: string, content: string): Promise<CommentDto> {
  const response = await api.patch<CommentDto>(`${SOCIAL_API}/comments/${commentId}`, { content });
  return response.data;
}

export async function deleteComment(commentId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/comments/${commentId}`);
}

export async function setCommentReaction(commentId: string, reactionType = 'like'): Promise<void> {
  await api.put(`${SOCIAL_API}/comments/${commentId}/reaction`, { reactionType });
}

export async function removeCommentReaction(commentId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/comments/${commentId}/reaction`);
}

export async function setReaction(postId: string, reactionType: string): Promise<void> {
  await api.put(`${SOCIAL_API}/posts/${postId}/reaction`, { reactionType });
}

export async function removeReaction(postId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/posts/${postId}/reaction`);
}

export async function fetchReactors(
  postId: string,
  type?: string,
): Promise<ReactionActorDto[]> {
  const response = await api.get<CursorPageOf<ReactionActorDto>>(
    `${SOCIAL_API}/posts/${postId}/reactions`,
    { params: { limit: 50, ...(type ? { type } : {}) } },
  );
  return response.data.items;
}

export async function sharePost(postId: string): Promise<void> {
  await api.post(`${SOCIAL_API}/posts/${postId}/share`);
}

// ---------------------------------------------------------------------------
// Hashtags
// ---------------------------------------------------------------------------

/** Normalized lowercase hashtags from text, e.g. "#TôiVàCuộcSống" -> "tôivàcuộcsống". */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]{1,50}/gu) ?? [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))].slice(0, 10);
}

/** Splits text into plain segments and hashtags (with their offsets) for rendering. */
export interface TextSegment {
  text: string;
  hashtag?: string;
}

export function splitHashtags(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const pattern = /#[\p{L}\p{N}_]{1,50}/gu;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: text.slice(last, index) });
    segments.push({ text: match[0], hashtag: match[0].slice(1).toLowerCase() });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments.length > 0 ? segments : [{ text }];
}

// ---------------------------------------------------------------------------
// Mentions
// ---------------------------------------------------------------------------

/** A piece of text that is either plain, a hashtag or an @mention. */
export interface RichSegment {
  text: string;
  hashtag?: string;
  /** the handle without the "@" */
  mention?: string;
}

const RICH_PATTERN = /(?<![\w@.])@([A-Za-z0-9_]{1,30})\b|#[\p{L}\p{N}_]{1,50}/gu;

/**
 * Splits text into plain / hashtag / mention segments. The mention handle is
 * kept lowercase so it can be matched against the resolved mention list.
 */
export function splitRichText(text: string): RichSegment[] {
  const segments: RichSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(RICH_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: text.slice(last, index) });
    const value = match[0];
    if (value.startsWith('@')) {
      segments.push({ text: value, mention: value.slice(1).toLowerCase() });
    } else {
      segments.push({ text: value, hashtag: value.slice(1).toLowerCase() });
    }
    last = index + value.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments.length > 0 ? segments : [{ text }];
}

/** The @handle being typed at the caret, e.g. "ali" for "@ali|". */
export function activeMentionQuery(text: string, caret: number): string | null {
  const before = text.slice(0, caret);
  const match = before.match(/(?:^|\s)@([A-Za-z0-9_]*)$/);
  return match ? match[1] : null;
}

/** Profiles whose @handle matches the query — used by the mention autocomplete. */
export async function searchMentionUsers(query: string, limit = 8): Promise<ProfileDto[]> {
  const text = query.trim();
  if (!text) return [];
  const response = await api.get<ProfileDto[]>(`${SOCIAL_API}/users/by-username`, {
    params: { q: text, limit },
  });
  response.data.forEach((profile) => primeProfile(profile));
  return response.data;
}

/** Resolves an @handle to a profile (null when nobody owns the handle). */
export async function fetchProfileByUsername(username: string): Promise<ProfileDto | null> {
  const response = await api.get<ProfileDto>(
    `${SOCIAL_API}/profiles/by-username/${encodeURIComponent(username)}`,
  );
  primeProfile(response.data);
  return response.data;
}

export async function fetchHashtagFeed(
  tag: string,
  cursor?: string,
  limit = 15,
): Promise<CursorPageOf<PostDto>> {
  const params = { limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<PostDto>>(
    `${SOCIAL_API}/feed/hashtag/${encodeURIComponent(tag)}`,
    { params },
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function createGroup(input: {
  name: string;
  description?: string | null;
  visibility: 'Public' | 'Private';
}): Promise<GroupDto> {
  const response = await api.post<GroupDto>(`${SOCIAL_API}/groups`, input);
  return response.data;
}

export async function fetchGroups(cursor?: string, limit = 20): Promise<CursorPageOf<GroupDto>> {
  const params = { limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<GroupDto>>(`${SOCIAL_API}/groups`, { params });
  return response.data;
}

export async function fetchMyGroups(): Promise<GroupDto[]> {
  const response = await api.get<GroupDto[]>(`${SOCIAL_API}/groups/mine`);
  return response.data;
}

export async function fetchGroup(groupId: string): Promise<GroupDto> {
  const response = await api.get<GroupDto>(`${SOCIAL_API}/groups/${groupId}`);
  return response.data;
}

export async function updateGroup(
  groupId: string,
  input: { name?: string; description?: string; visibility?: 'Public' | 'Private' },
): Promise<GroupDto> {
  const response = await api.patch<GroupDto>(`${SOCIAL_API}/groups/${groupId}`, input);
  return response.data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/groups/${groupId}`);
}

export async function joinGroup(groupId: string): Promise<GroupDto> {
  const response = await api.post<GroupDto>(`${SOCIAL_API}/groups/${groupId}/join`);
  return response.data;
}

export async function leaveGroup(groupId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/groups/${groupId}/join`);
}

export async function fetchGroupMembers(
  groupId: string,
  status?: 'active' | 'pending',
): Promise<GroupMemberDto[]> {
  const response = await api.get<CursorPageOf<GroupMemberDto>>(
    `${SOCIAL_API}/groups/${groupId}/members`,
    { params: { limit: 100, ...(status ? { status } : {}) } },
  );
  return response.data.items;
}

export async function approveGroupMember(groupId: string, userId: string): Promise<void> {
  await api.post(`${SOCIAL_API}/groups/${groupId}/members/${userId}/approve`);
}

export async function declineGroupMember(groupId: string, userId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/groups/${groupId}/members/${userId}/request`);
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/groups/${groupId}/members/${userId}`);
}

export async function fetchGroupPosts(
  groupId: string,
  cursor?: string,
  limit = 15,
): Promise<CursorPageOf<PostDto>> {
  const params = { limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<PostDto>>(`${SOCIAL_API}/groups/${groupId}/posts`, {
    params,
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function createEvent(input: {
  title: string;
  description?: string | null;
  locationText?: string | null;
  onlineUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  groupId?: string | null;
}): Promise<EventDto> {
  const response = await api.post<EventDto>(`${SOCIAL_API}/events`, input);
  return response.data;
}

export async function fetchEvents(cursor?: string, limit = 20): Promise<CursorPageOf<EventDto>> {
  const params = { limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<EventDto>>(`${SOCIAL_API}/events`, { params });
  return response.data;
}

export async function fetchEvent(eventId: string): Promise<EventDto> {
  const response = await api.get<EventDto>(`${SOCIAL_API}/events/${eventId}`);
  return response.data;
}

export async function updateEvent(
  eventId: string,
  input: {
    title?: string;
    description?: string;
    locationText?: string;
    onlineUrl?: string;
    startsAt?: string;
    endsAt?: string | null;
  },
): Promise<EventDto> {
  const response = await api.patch<EventDto>(`${SOCIAL_API}/events/${eventId}`, input);
  return response.data;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/events/${eventId}`);
}

/** rsvp: "going" | "interested" | "notgoing" (notgoing removes the attendee row) */
export async function setEventRsvp(eventId: string, rsvp: string): Promise<void> {
  await api.put(`${SOCIAL_API}/events/${eventId}/rsvp`, { rsvp });
}

export async function fetchEventAttendees(
  eventId: string,
  rsvp?: 'going' | 'interested',
): Promise<EventAttendeeDto[]> {
  const response = await api.get<CursorPageOf<EventAttendeeDto>>(
    `${SOCIAL_API}/events/${eventId}/attendees`,
    { params: { limit: 100, ...(rsvp ? { rsvp } : {}) } },
  );
  return response.data.items;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export async function createPage(input: {
  name: string;
  description?: string | null;
  category?: string | null;
}): Promise<PageDto> {
  const response = await api.post<PageDto>(`${SOCIAL_API}/pages`, input);
  return response.data;
}

export async function fetchPages(cursor?: string, limit = 20): Promise<CursorPageOf<PageDto>> {
  const params = { limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<PageDto>>(`${SOCIAL_API}/pages`, { params });
  return response.data;
}

export async function fetchMyPages(): Promise<PageDto[]> {
  const response = await api.get<PageDto[]>(`${SOCIAL_API}/pages/mine`);
  return response.data;
}

export async function fetchPage(pageId: string): Promise<PageDto> {
  const response = await api.get<PageDto>(`${SOCIAL_API}/pages/${pageId}`);
  return response.data;
}

export async function updatePage(
  pageId: string,
  input: { name?: string; description?: string; category?: string },
): Promise<PageDto> {
  const response = await api.patch<PageDto>(`${SOCIAL_API}/pages/${pageId}`, input);
  return response.data;
}

export async function deletePage(pageId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/pages/${pageId}`);
}

export async function fetchPageAdmins(pageId: string): Promise<PageAdminDto[]> {
  const response = await api.get<PageAdminDto[]>(`${SOCIAL_API}/pages/${pageId}/admins`);
  return response.data;
}

export async function addPageAdmin(
  pageId: string,
  userId: string,
  role: 'admin' | 'editor' | 'moderator' = 'admin',
): Promise<PageAdminDto> {
  const response = await api.post<PageAdminDto>(
    `${SOCIAL_API}/pages/${pageId}/admins/${userId}`,
    undefined,
    { params: { role } },
  );
  return response.data;
}

export async function removePageAdmin(pageId: string, userId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/pages/${pageId}/admins/${userId}`);
}

export async function fetchPagePosts(
  pageId: string,
  cursor?: string,
  limit = 15,
): Promise<CursorPageOf<PostDto>> {
  const params = { limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<PostDto>>(`${SOCIAL_API}/pages/${pageId}/posts`, {
    params,
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// Stories & Highlights
// ---------------------------------------------------------------------------

export async function createStory(input: {
  mediaAssetId: string;
  caption?: string | null;
  /** 0=Public, 1=Friends, 2=OnlyMe */
  visibility?: number;
}): Promise<StoryDto> {
  const response = await api.post<StoryDto>(`${SOCIAL_API}/stories`, {
    mediaAssetId: input.mediaAssetId,
    caption: input.caption ?? null,
    visibility: input.visibility ?? 1,
  });
  return response.data;
}

export async function fetchStoryFeed(): Promise<StoryAuthorDto[]> {
  const response = await api.get<StoryAuthorDto[]>(`${SOCIAL_API}/stories/feed`);
  return response.data;
}

export async function fetchStory(storyId: string): Promise<StoryDto> {
  const response = await api.get<StoryDto>(`${SOCIAL_API}/stories/${storyId}`);
  return response.data;
}

/** Marks the story as seen by the viewer (idempotent). */
export async function viewStory(storyId: string): Promise<StoryDto> {
  const response = await api.post<StoryDto>(`${SOCIAL_API}/stories/${storyId}/view`);
  return response.data;
}

export async function deleteStory(storyId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/stories/${storyId}`);
}

/** Owner-only: change who can see a story. */
export async function updateStory(
  storyId: string,
  payload: { visibility?: number; caption?: string | null },
): Promise<StoryDto> {
  const response = await api.put<StoryDto>(`${SOCIAL_API}/stories/${storyId}`, payload);
  return response.data;
}

/** Viewer list of one story — only the author may read it. */
export async function fetchStoryViews(storyId: string): Promise<StoryViewDto[]> {
  const response = await api.get<StoryViewDto[]>(`${SOCIAL_API}/stories/${storyId}/views`);
  return response.data;
}

export async function createHighlight(title: string): Promise<HighlightDto> {
  const response = await api.post<HighlightDto>(`${SOCIAL_API}/highlights`, { title });
  return response.data;
}

export async function fetchMyHighlights(): Promise<HighlightDto[]> {
  const response = await api.get<HighlightDto[]>(`${SOCIAL_API}/highlights/mine`);
  return response.data;
}

export async function fetchHighlights(ownerUserId: string): Promise<HighlightDto[]> {
  const response = await api.get<HighlightDto[]>(`${SOCIAL_API}/highlights/${ownerUserId}`);
  return response.data;
}

export async function fetchHighlightStories(highlightId: string): Promise<StoryDto[]> {
  const response = await api.get<StoryDto[]>(`${SOCIAL_API}/highlights/${highlightId}/stories`);
  return response.data;
}

/** Archives a story into a highlight (the story leaves the 24h rail). */
export async function addStoryToHighlight(highlightId: string, storyId: string): Promise<void> {
  await api.post(`${SOCIAL_API}/highlights/${highlightId}/stories/${storyId}`);
}

export async function removeStoryFromHighlight(
  highlightId: string,
  storyId: string,
): Promise<void> {
  await api.delete(`${SOCIAL_API}/highlights/${highlightId}/stories/${storyId}`);
}

export async function deleteHighlight(highlightId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/highlights/${highlightId}`);
}

// ---------------------------------------------------------------------------
// Reels
// ---------------------------------------------------------------------------

export async function createReel(input: {
  mediaAssetId: string;
  caption?: string | null;
  /** 0=Public, 1=Friends, 2=OnlyMe */
  visibility?: number;
}): Promise<ReelDto> {
  const response = await api.post<ReelDto>(`${SOCIAL_API}/reels`, {
    mediaAssetId: input.mediaAssetId,
    caption: input.caption ?? null,
    visibility: input.visibility ?? 0,
  });
  return response.data;
}

/** Reel feed: "foryou" (everything visible) or "following" (people you follow). */
export async function fetchReels(
  tab: 'foryou' | 'following' = 'foryou',
  cursor?: string,
  limit = 10,
): Promise<CursorPageOf<ReelDto>> {
  const params = { tab, limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<ReelDto>>(`${SOCIAL_API}/reels`, { params });
  return response.data;
}

/** Reels published by one creator (profile grid). */
export async function fetchProfileReels(
  userId: string,
  cursor?: string,
  limit = 12,
): Promise<CursorPageOf<ReelDto>> {
  const params = { limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<ReelDto>>(`${SOCIAL_API}/profiles/${userId}/reels`, {
    params,
  });
  return response.data;
}

export async function fetchReel(reelId: string): Promise<ReelDto> {
  const response = await api.get<ReelDto>(`${SOCIAL_API}/reels/${reelId}`);
  return response.data;
}

/** Reports a playback session; the backend only counts views above a threshold. */
export async function recordReelView(reelId: string, watchedMs: number): Promise<ReelDto> {
  const response = await api.post<ReelDto>(`${SOCIAL_API}/reels/${reelId}/view`, { watchedMs });
  return response.data;
}

export async function deleteReel(reelId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/reels/${reelId}`);
}

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

export async function fetchBookmarks(cursor?: string, limit = 15): Promise<CursorPageOf<PostDto>> {
  const params = { limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<PostDto>>(`${SOCIAL_API}/me/bookmarks`, { params });
  return response.data;
}

export async function saveBookmark(postId: string): Promise<void> {
  await api.put(`${SOCIAL_API}/posts/${postId}/bookmark`);
}

export async function removeBookmark(postId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/posts/${postId}/bookmark`);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchAll(query: string, limit = 10): Promise<SearchResultDto> {
  const response = await api.get<SearchResultDto>(`${SOCIAL_API}/search`, {
    params: { q: query, limit },
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// Relationship: follow / block / mute / friends
// ---------------------------------------------------------------------------

export async function fetchRelationship(userId: string): Promise<RelationshipDto> {
  const response = await api.get<RelationshipDto>(`${SOCIAL_API}/users/${userId}/relationship`);
  return response.data;
}

export async function followUser(userId: string): Promise<void> {
  await api.post(`${SOCIAL_API}/users/${userId}/follow`);
}

export async function unfollowUser(userId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/users/${userId}/follow`);
}

export async function blockUser(userId: string): Promise<void> {
  await api.post(`${SOCIAL_API}/users/${userId}/block`);
}

export async function unblockUser(userId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/users/${userId}/block`);
}

export async function muteUser(userId: string): Promise<void> {
  await api.post(`${SOCIAL_API}/users/${userId}/mute`);
}

export async function unmuteUser(userId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/users/${userId}/mute`);
}

export async function removeFriend(userId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/friends/${userId}`);
}

export async function sendFriendRequest(userId: string): Promise<FriendRequestResultDto> {
  const response = await api.post<FriendRequestResultDto>(`${SOCIAL_API}/friend-requests`, undefined, {
    params: { userId },
  });
  return response.data;
}

export async function fetchReceivedFriendRequests(): Promise<FriendRequestDto[]> {
  const response = await api.get<FriendRequestDto[]>(`${SOCIAL_API}/friend-requests/received`);
  response.data.forEach((request) => primeProfile(request.profile));
  return response.data;
}

export async function fetchSentFriendRequests(): Promise<FriendRequestDto[]> {
  const response = await api.get<FriendRequestDto[]>(`${SOCIAL_API}/friend-requests/sent`);
  response.data.forEach((request) => primeProfile(request.profile));
  return response.data;
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  await api.post(`${SOCIAL_API}/friend-requests/${requestId}/accept`);
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  await api.post(`${SOCIAL_API}/friend-requests/${requestId}/decline`);
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  await api.delete(`${SOCIAL_API}/friend-requests/${requestId}`);
}

// ---------------------------------------------------------------------------
// Media upload ([stora] 2-step: ticket → PUT → complete)
// ---------------------------------------------------------------------------

export type UploadKind = 'avatar' | 'cover' | 'images' | 'videos' | 'stories' | 'post';

export async function uploadMedia(file: File, kind: UploadKind): Promise<string> {
  const ticket = await api.post<UploadTicketDto>(`${SOCIAL_API}/media/uploads`, {
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    kind,
  });

  if (ticket.data.directUpload) {
    // The ticket is a pre-signed URL: the request must carry no app credentials,
    // so use a bare axios instance instead of `api` (whose interceptor attaches
    // our JWT, which storage rejects).
    await axios.put(ticket.data.uploadUrl, file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
  } else {
    // This storage provider cannot take a browser upload, so the service
    // writes the bytes itself.
    await api.post(`${SOCIAL_API}/media/uploads/${ticket.data.mediaId}/content`, file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
  }

  await api.post(`${SOCIAL_API}/media/uploads/${ticket.data.mediaId}/complete`);
  return ticket.data.mediaId;
}

export async function setProfileAvatar(mediaId: string): Promise<ProfileDto> {
  const response = await api.patch<ProfileDto>(`${SOCIAL_API}/me/profile/avatar`, { mediaId });
  primeProfile(response.data);
  return response.data;
}

export async function setProfileCover(mediaId: string): Promise<ProfileDto> {
  const response = await api.patch<ProfileDto>(`${SOCIAL_API}/me/profile/cover`, { mediaId });
  primeProfile(response.data);
  return response.data;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function fetchNotifications(
  status: 'all' | 'unread' = 'all',
  limit = 50,
): Promise<NotificationApiDto[]> {
  const params = status === 'unread' ? { status: 'unread', limit } : { limit };
  const response = await api.get<NotificationApiDto[]>(`${NOTIFICATION_API}/notifications`, {
    params,
  });
  return response.data;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await api.post(`${NOTIFICATION_API}/notifications/${notificationId}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post(`${NOTIFICATION_API}/notifications/read-all`);
}

// ---------------------------------------------------------------------------
// Shared unread-notification counter (used by both navbar badge and sidebar)
// ---------------------------------------------------------------------------

let unreadNotificationCount = 0;
const unreadListeners = new Set<(count: number) => void>();

export function getUnreadNotificationCount(): number {
  return unreadNotificationCount;
}

export function setUnreadNotificationCount(count: number): void {
  unreadNotificationCount = count;
  unreadListeners.forEach((listener) => listener(count));
}

export function subscribeUnreadNotifications(listener: (count: number) => void): () => void {
  unreadListeners.add(listener);
  listener(unreadNotificationCount);
  return () => {
    unreadListeners.delete(listener);
  };
}

export async function refreshUnreadNotificationCount(): Promise<number> {
  try {
    const response = await api.get<{ count: number }>(`${NOTIFICATION_API}/notifications/unread-count`);
    const count = response.data?.count ?? 0;
    setUnreadNotificationCount(count);
    return count;
  } catch {
    return unreadNotificationCount;
  }
}

// ---------------------------------------------------------------------------
// Profile posts (`GET /users/{userId}/posts`)
// ---------------------------------------------------------------------------

export async function fetchUserPosts(
  userId: string,
  cursor?: string,
  limit = 15,
): Promise<CursorPageOf<PostDto>> {
  const params = { limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<PostDto>>(`${SOCIAL_API}/users/${userId}/posts`, {
    params,
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// Chat (`/chat/api/v1`)
// ---------------------------------------------------------------------------

export async function fetchConversations(): Promise<ConversationDto[]> {
  const response = await api.get<ConversationDto[]>(`${CHAT_API}/conversations`);
  return response.data;
}

export async function fetchMessages(
  conversationId: string,
  cursor?: string,
  limit = 50,
): Promise<CursorPageOf<ChatMessageDto>> {
  const params = { limit, ...(cursor ? { cursor } : {}) };
  const response = await api.get<CursorPageOf<ChatMessageDto>>(
    `${CHAT_API}/conversations/${conversationId}/messages`,
    { params },
  );
  return response.data;
}

export async function sendChatMessage(
  conversationId: string,
  body: string,
  replyToMessageId?: string | null,
  attachments: ChatAttachmentUpload[] = [],
): Promise<ChatMessageDto> {
  const response = await api.post<ChatMessageDto>(
    `${CHAT_API}/conversations/${conversationId}/messages`,
    { body, attachments, replyToMessageId: replyToMessageId ?? null },
  );
  return response.data;
}

/**
 * Uploads one file into the conversation and returns the descriptor the send
 * endpoint expects. The ticket is a pre-signed [stora] URL, so the upload must
 * go out without the app credentials — a bare axios instance is used for that.
 */
export async function uploadChatAttachment(
  conversationId: string,
  file: File,
): Promise<ChatAttachmentUpload> {
  const contentType = file.type || 'application/octet-stream';
  const ticket = await api.post<ChatAttachmentUploadTicket>(
    `${CHAT_API}/conversations/${conversationId}/attachments/ticket`,
    undefined,
    { params: { fileName: file.name, contentType } },
  );

  await axios.put(ticket.data.uploadUrl, file, {
    headers: { 'Content-Type': contentType },
  });

  return {
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
    mediaId: ticket.data.mediaId,
  };
}

export async function editChatMessage(messageId: string, body: string): Promise<ChatMessageDto> {
  const response = await api.patch<ChatMessageDto>(`${CHAT_API}/messages/${messageId}`, { body });
  return response.data;
}

/** Recalls a message for everybody: both sides see a "recalled" placeholder. */
export async function deleteChatMessage(messageId: string): Promise<void> {
  await api.delete(`${CHAT_API}/messages/${messageId}`);
}

/** Deletes a message for the viewer only; everybody else keeps seeing it. */
export async function hideChatMessage(messageId: string): Promise<void> {
  await api.delete(`${CHAT_API}/messages/${messageId}/hide`);
}

export async function addChatMessageReaction(
  messageId: string,
  reactionType: string,
): Promise<ChatMessageReactionDto> {
  const response = await api.put<ChatMessageReactionDto>(
    `${CHAT_API}/messages/${messageId}/reactions/${encodeURIComponent(reactionType)}`,
  );
  return response.data;
}

export async function removeChatMessageReaction(
  messageId: string,
  reactionType: string,
): Promise<ChatMessageReactionDto> {
  const response = await api.delete<ChatMessageReactionDto>(
    `${CHAT_API}/messages/${messageId}/reactions/${encodeURIComponent(reactionType)}`,
  );
  return response.data;
}

export async function createDirectConversation(otherUserId: string): Promise<ConversationDto> {
  const response = await api.post<ConversationDto>(`${CHAT_API}/conversations`, {
    type: 'dm',
    title: null,
    memberUserIds: [otherUserId],
  });
  return response.data;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await api.post(`${CHAT_API}/conversations/${conversationId}/read`);
}
