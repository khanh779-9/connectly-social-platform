import { api } from '@/lib/api';
import { CHAT_API, timeAgo } from '@/lib/social';
import type { PresenceDto } from '@/types/api';

/**
 * Online flag plus the last time each user was active.
 * Presence is decoration: when chat is unavailable everybody just reads as offline.
 */
export async function fetchPresence(userIds: string[]): Promise<Record<string, PresenceDto>> {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return {};

  try {
    const response = await api.get<Record<string, PresenceDto>>(`${CHAT_API}/presence`, {
      params: { userIds: ids.join(',') },
    });
    return response.data;
  } catch {
    return {};
  }
}

/** "Active now", "Active 3h ago", "Active 2d ago" — null when the user has never been seen. */
export function presenceLabel(presence?: PresenceDto | null): string | null {
  if (!presence) return null;
  if (presence.online) return 'Active now';
  if (presence.lastSeenAt) return `Active ${timeAgo(presence.lastSeenAt)}`;
  return null;
}
