import { emptyAuthSession } from '@tuljai/shared';
import type { AuthSession } from '@tuljai/shared';
import * as SecureStore from 'expo-secure-store';

// These keys match the previous app so people who are already signed in stay signed in
// after the new interface is delivered.
const ACCESS_TOKEN_KEY = 'tuljai.pilgrim.accessToken';
const REFRESH_TOKEN_KEY = 'tuljai.pilgrim.refreshToken';
const SESSION_KEY = 'tuljai.pilgrim.authSession';
const DEVICE_ID_KEY = 'tuljai.pilgrim.deviceId';

let cachedSession: AuthSession = emptyAuthSession;
const listeners = new Set<(session: AuthSession) => void>();

function notify(): void {
  for (const listener of listeners) listener(cachedSession);
}

export function subscribeSession(listener: (session: AuthSession) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentSession(): AuthSession {
  return cachedSession;
}

export async function loadSession(): Promise<AuthSession> {
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  if (!stored) {
    cachedSession = emptyAuthSession;
    return cachedSession;
  }
  try {
    cachedSession = JSON.parse(stored) as AuthSession;
  } catch {
    await clearSession();
  }
  return cachedSession;
}

export async function saveSession(session: AuthSession): Promise<void> {
  cachedSession = session;
  if (session.tokens) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.tokens.refreshToken),
    ]);
  }
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  notify();
}

export async function clearSession(): Promise<void> {
  cachedSession = emptyAuthSession;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(SESSION_KEY),
  ]);
  notify();
}

export async function updateAccessToken(accessToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  if (cachedSession.tokens) {
    cachedSession = { ...cachedSession, tokens: { ...cachedSession.tokens, accessToken } };
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(cachedSession));
    notify();
  }
}

export function readAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export function readRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function deviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created);
  return created;
}
