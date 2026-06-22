import { api, IDENTITY_API } from '@/lib/api';
import type { UserSessionDto } from '@/types/api';

/** Devices signed in to the current account, newest activity first. */
export async function fetchSessions(): Promise<UserSessionDto[]> {
  const response = await api.get<UserSessionDto[]>(`${IDENTITY_API}/security/sessions`);
  return response.data;
}

/** Ends the selected sessions; returns how many were revoked. */
export async function revokeSessions(ids: string[]): Promise<number> {
  const response = await api.post<{ revoked: number }>(
    `${IDENTITY_API}/security/sessions/revoke`,
    { ids },
  );
  return response.data.revoked;
}
