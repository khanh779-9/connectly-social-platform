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

