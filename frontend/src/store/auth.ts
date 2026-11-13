import { create } from 'zustand';
import type { AuthResponse, User } from '@/types/api';
import { ApiClientError, apiGet, apiPatch, apiPost } from '@/lib/api';
import {
  clearSession,
  hasSession,
  loadStoredSession,
  setSession as persistSession,
} from '@/lib/session';
import { deleteSecureItem, getJson, setJson } from '@/lib/storage';
import { queryClient } from '@/lib/queryClient';

const USER_CACHE_KEY = 'qd_auth_user';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export interface ProfileInput {
  name?: string;
  email?: string;
  currentPassword?: string;
}

interface AuthState {
  status: 'loading' | 'authenticated' | 'guest';
  user: User | null;
  bootstrap: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (input: ProfileInput) => Promise<User>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ resetToken?: string }>;
  resetPassword: (token: string, password: string) => Promise<void>;
  handleSessionExpired: () => void;
  updateCachedUser: (user: User) => Promise<void>;
}

let bootstrapPromise: Promise<void> | null = null;

async function cacheUser(user: User): Promise<void> {
  await setJson(USER_CACHE_KEY, user);
}

async function readCachedUser(): Promise<User | null> {
  return getJson<User>(USER_CACHE_KEY);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,

  bootstrap: async () => {
    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = (async () => {
      let stored: Awaited<ReturnType<typeof loadStoredSession>> = null;
      try {
        stored = await loadStoredSession();
      } catch {
        // Secure storage being unavailable must not leave the app on a blank
        // loading screen forever.
        set({ status: 'guest', user: null });
        return;
      }
      if (!stored) {
        await deleteSecureItem(USER_CACHE_KEY);
        queryClient.clear();
        set({ status: 'guest', user: null });
        return;
      }

      let cachedUser: User | null = null;
      try {
        cachedUser = await readCachedUser();
      } catch {
        cachedUser = null;
      }
      try {
        const user = await apiGet<User>('/users/me');
        await cacheUser(user);
        set({ status: 'authenticated', user });
      } catch (error) {
        const recoverable =
          error instanceof ApiClientError &&
          (error.status === 0 || error.status >= 500);
        if (cachedUser && hasSession() && recoverable) {
          // Keep the cached profile only while the session is still valid and
          // the failure is transient. A revoked session must never resurrect.
          set({ status: 'authenticated', user: cachedUser });
        } else {
          await clearSession();
          await deleteSecureItem(USER_CACHE_KEY);
          queryClient.clear();
          set({ status: 'guest', user: null });
        }
      }
    })().finally(() => {
      bootstrapPromise = null;
    });
    return bootstrapPromise;
  },

  login: async (input) => {
    const result = await apiPost<AuthResponse>('/auth/login', input);
    await persistSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    await cacheUser(result.user);
    queryClient.clear();
    set({ status: 'authenticated', user: result.user });
  },

  register: async (input) => {
    const result = await apiPost<AuthResponse>('/auth/register', input);
    await persistSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    await cacheUser(result.user);
    queryClient.clear();
    set({ status: 'authenticated', user: result.user });
  },

  logout: async () => {
    const stored = await loadStoredSession();
    try {
      if (stored?.refreshToken) {
        await apiPost<null>('/auth/logout', { refreshToken: stored.refreshToken });
      }
    } catch {
      // Local sign-out must still succeed if the network is unavailable.
    } finally {
      await clearSession();
      await deleteSecureItem(USER_CACHE_KEY);
      queryClient.clear();
      set({ status: 'guest', user: null });
    }
  },

  logoutAll: async () => {
    try {
      await apiPost<null>('/auth/logout-all');
    } finally {
      await clearSession();
      await deleteSecureItem(USER_CACHE_KEY);
      queryClient.clear();
      set({ status: 'guest', user: null });
    }
  },

  refreshProfile: async () => {
    const user = await apiGet<User>('/users/me');
    await cacheUser(user);
    set({ user, status: 'authenticated' });
  },

  updateProfile: async (input) => {
    const user = await apiPatch<User>('/users/me', input);
    await cacheUser(user);
    set({ user });
    return user;
  },

  changePassword: async (input) => {
    const result = await apiPatch<AuthResponse>('/users/me/password', input);
    await persistSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    await cacheUser(result.user);
    set({ status: 'authenticated', user: result.user });
  },

  forgotPassword: async (email) => {
    return apiPost<{ resetToken?: string }>('/auth/forgot-password', { email });
  },

  resetPassword: async (token, password) => {
    await apiPost<null>('/auth/reset-password', { token, password });
  },

  handleSessionExpired: () => {
    queryClient.clear();
    set({ status: 'guest', user: null });
    void deleteSecureItem(USER_CACHE_KEY);
  },

  updateCachedUser: async (user) => {
    await cacheUser(user);
    if (get().status === 'authenticated') set({ user });
  },
}));
