import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { getDeviceId, readSession, saveSession, clearSession } from '@/store/session';

const identityApi = import.meta.env.VITE_IDENTITY_API_URL ?? '';

export const IDENTITY_API = identityApi;
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '' });

// Only one token refresh runs at a time. Requests that hit a 401 while the
// refresh is running wait for the same promise instead of refreshing again.
let refreshTask: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const session = readSession();
  if (!session.refreshToken) throw new Error('There is no refresh token to use.');

  const { data } = await axios.post(
    `${identityApi.replace(/\/$/, '')}/auth/refresh`,
    { refreshToken: session.refreshToken, rememberMe: session.rememberMe },
    { headers: { 'X-Device-Id': getDeviceId() } },
  );

  // The user may have logged out or logged in again while we were waiting.
  // In that case the newer session wins and must not be overwritten.
  const current = readSession();
  if (current.refreshToken !== session.refreshToken) {
    return current.accessToken ?? data.accessToken;
  }

  saveSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? session.refreshToken,
    userId: data.userId ?? session.userId,
    displayName: data.displayName ?? session.displayName,
    rememberMe: data.rememberMe ?? session.rememberMe,
  });

  return data.accessToken;
}

async function getFreshToken(): Promise<string> {
  if (!refreshTask) {
    refreshTask = refreshAccessToken().finally(() => {
      refreshTask = null;
    });
  }
  return refreshTask;
}

