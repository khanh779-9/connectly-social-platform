import { api } from '@/lib/api';

export type ThemeMode = 'light' | 'dark' | 'system';

/** Per-user setting, stored in identity.user_preferences. */
const PREFS_PATH = '/identity/api/v1/me/preferences';
const STORAGE_KEY = 'connectly.theme';
const CHANGE_EVENT = 'connectly:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readTheme(): ThemeMode {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  }
  return mode;
}

/** Paint the chosen theme onto <html>; the `.dark` class drives the CSS tokens. */
export function applyTheme(mode: ThemeMode = readTheme()) {
  const resolved = resolve(mode);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
}

export function setTheme(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(mode);
  window.dispatchEvent(new CustomEvent<ThemeMode>(CHANGE_EVENT, { detail: mode }));
  // Persist for this user; the local value already applies, so a failed write is not fatal.
  api.put(PREFS_PATH, { theme: mode }).catch(() => undefined);
}

function normalize(value: unknown): ThemeMode | null {
  return value === 'light' || value === 'dark' || value === 'system' ? value : null;
}

/**
 * Pull the signed-in user's saved theme and apply it. Call after authentication; the cached
 * local value keeps the first paint correct while the request is in flight.
 */
export async function loadServerTheme(): Promise<ThemeMode | null> {
  try {
    const { data } = await api.get<{ theme?: string }>(PREFS_PATH);
    const mode = normalize(data?.theme);
    if (!mode) return null;
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
    window.dispatchEvent(new CustomEvent<ThemeMode>(CHANGE_EVENT, { detail: mode }));
    return mode;
  } catch {
    // Offline or signed out: keep whatever is stored locally.
    return null;
  }
}

/** Fires for in-app changes and for edits made in another tab. */
export function subscribeTheme(listener: (mode: ThemeMode) => void): () => void {
  const onLocal = (event: Event) => {
    listener((event as CustomEvent<ThemeMode>).detail ?? readTheme());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener(readTheme());
  };
  window.addEventListener(CHANGE_EVENT, onLocal);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onLocal);
    window.removeEventListener('storage', onStorage);
  };
}

/** Call once at startup: applies the stored theme and follows the OS when set to Auto. */
export function initTheme() {
  applyTheme();
  window
    .matchMedia(DARK_QUERY)
    .addEventListener('change', () => {
      if (readTheme() === 'system') applyTheme('system');
    });
}
