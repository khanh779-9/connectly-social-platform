const SESSION_KEY = 'connectly.auth';
const DEVICE_KEY = 'connectly.device';

export interface StoredSession {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  displayName: string | null;
  rememberMe: boolean;
}

function emptySession(): StoredSession {
  return {
    accessToken: null,
    refreshToken: null,
    userId: null,
    displayName: null,
    rememberMe: false,
  };
}

/** Reads the session that was saved in localStorage. */
export function readSession(): StoredSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return emptySession();

    const data = JSON.parse(raw);
    return {
      accessToken: data.accessToken ?? null,
      refreshToken: data.refreshToken ?? null,
      userId: data.userId ?? null,
      displayName: data.displayName ?? null,
      rememberMe: data.rememberMe ?? false,
    };
  } catch {
    return emptySession();
  }
}

/** Saves the session into localStorage. Fields left out keep their old value. */
export function saveSession(session: Partial<StoredSession>): void {
  const merged = { ...readSession(), ...session };
  localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
}

/** Removes the session (used when the user logs out). */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function readAccessToken(): string | null {
  return readSession().accessToken;
}

/** A stable id for this browser, sent with every request as X-Device-Id. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;

    const created =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return 'unknown-device';
  }
}
