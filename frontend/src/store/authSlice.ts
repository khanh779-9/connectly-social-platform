import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios, { isAxiosError } from 'axios';
import type { LoginRequest, RegisterRequest, AuthResponse } from '../types/auth';
import { IDENTITY_API } from '../lib/api';
import { getDeviceId, readSession, saveSession, clearSession } from './session';

const identityApi = IDENTITY_API.replace(/\/$/, '');

export type AuthStatus = 'idle' | 'loading' | 'failed';

export interface AuthState {
  token: string | null;
  userId: string | null;
  displayName: string | null;
  refreshToken: string | null;
  rememberMe: boolean;
  status: AuthStatus;
  error: string | null;
}

function emptyAuthState(): AuthState {
  return {
    token: null,
    userId: null,
    displayName: null,
    refreshToken: null,
    rememberMe: false,
    status: 'idle',
    error: null,
  };
}

/** The app starts with the session that was saved in localStorage. */
function initialAuthState(): AuthState {
  const session = readSession();
  return {
    token: session.accessToken,
    userId: session.userId,
    displayName: session.displayName,
    refreshToken: session.refreshToken,
    rememberMe: session.rememberMe,
    status: 'idle',
    error: null,
  };
}

function getAuthError(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; detail?: string; errors?: Array<{ message?: string }> }
      | undefined;
    const message = data?.message ?? data?.errors?.[0]?.message ?? data?.detail;
    if (message) return message;
    if (!error.response) return 'Unable to reach the server. Please try again.';
    if (error.response.status >= 500) return 'The server could not complete the request. Please try again.';
  }
  return fallback;
}

export const login = createAsyncThunk<AuthResponse, LoginRequest, { rejectValue: string }>(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await axios.post<AuthResponse>(
        `${identityApi}/auth/login`,
        credentials,
        { headers: { 'X-Device-Id': getDeviceId() } },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getAuthError(error, 'Invalid email or password.'));
    }
  },
);

export const register = createAsyncThunk<AuthResponse, RegisterRequest, { rejectValue: string }>(
  'auth/register',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await axios.post<AuthResponse>(
        `${identityApi}/auth/register`,
        payload,
        { headers: { 'X-Device-Id': getDeviceId() } },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(getAuthError(error, 'Registration failed. Please try again.'));
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState(),
  reducers: {
    logout: (state) => {
      clearSession();
      Object.assign(state, emptyAuthState());
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        const rememberMe = action.meta.arg.rememberMe ?? action.payload.rememberMe ?? false;
        state.status = 'idle';
        state.token = action.payload.accessToken;
        state.userId = action.payload.userId;
        state.displayName = action.payload.displayName;
        state.refreshToken = action.payload.refreshToken;
        state.rememberMe = rememberMe;
        saveSession({
          accessToken: action.payload.accessToken,
          refreshToken: action.payload.refreshToken,
          userId: action.payload.userId,
          displayName: action.payload.displayName,
          rememberMe,
        });
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Login failed.';
      })
      .addCase(register.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        const rememberMe = action.meta.arg.rememberMe ?? action.payload.rememberMe ?? false;
        state.status = 'idle';
        state.token = action.payload.accessToken;
        state.userId = action.payload.userId;
        state.displayName = action.payload.displayName;
        state.refreshToken = action.payload.refreshToken;
        state.rememberMe = rememberMe;
        saveSession({
          accessToken: action.payload.accessToken,
          refreshToken: action.payload.refreshToken,
          userId: action.payload.userId,
          displayName: action.payload.displayName,
          rememberMe,
        });
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Registration failed. Please try again.';
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
