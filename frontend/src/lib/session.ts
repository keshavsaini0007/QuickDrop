import axios, { isAxiosError } from 'axios';
import type { ApiEnvelope, AuthResponse } from '@/types/api';
import { API_BASE_URL } from './config';
import { deleteSecureItem, getJson, setJson } from './storage';

const SESSION_KEY = 'qd_auth_session';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

let currentSession: StoredSession | null = null;
let refreshPromise: Promise<string> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === 'string' &&
    candidate.accessToken.length > 0 &&
    typeof candidate.refreshToken === 'string' &&
    candidate.refreshToken.length > 0
  );
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  if (currentSession) return currentSession;
  const stored = await getJson<unknown>(SESSION_KEY);
  if (!isStoredSession(stored)) return null;
  currentSession = stored;
  return stored;
}

export async function setSession(session: StoredSession): Promise<void> {
  currentSession = session;
  await setJson(SESSION_KEY, session);
}

export async function clearSession(): Promise<void> {
  currentSession = null;
  refreshPromise = null;
  await deleteSecureItem(SESSION_KEY);
}

export function getAccessToken(): string | null {
  return currentSession?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return currentSession?.refreshToken ?? null;
}

export function hasSession(): boolean {
  return Boolean(currentSession?.accessToken && currentSession.refreshToken);
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = currentSession?.refreshToken;
  if (!refreshToken) {
    throw new Error('No refresh token is available.');
  }

  refreshPromise = axios
    .post<ApiEnvelope<AuthResponse>>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 20_000 },
    )
    .then(async (response) => {
      const data = response.data.data;
      await setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return data.accessToken;
    })
    .catch(async (error: unknown) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      // A network outage or server error must not sign the user out. Only an
      // explicit rejection of the refresh token invalidates the local session.
      if (status === 400 || status === 401 || status === 403) {
        await clearSession();
        sessionExpiredHandler?.();
      }
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}
