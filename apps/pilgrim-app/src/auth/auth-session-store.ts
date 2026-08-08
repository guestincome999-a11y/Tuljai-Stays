import { emptyAuthSession, type AuthSession } from '@tuljai/shared';
import * as SecureStore from 'expo-secure-store';

import { secureTokenStore } from './secure-token-store';
import { getWebSessionStorage } from './web-session-storage';

const SESSION_KEY = 'tuljai.pilgrim.authSession';

let cachedSession: AuthSession = emptyAuthSession;
const sessionListeners = new Set<(session: AuthSession) => void>();

function notifySessionListeners(): void {
  for (const listener of sessionListeners) {
    listener(cachedSession);
  }
}

export function subscribeAuthSession(listener: (session: AuthSession) => void): () => void {
  sessionListeners.add(listener);

  return () => {
    sessionListeners.delete(listener);
  };
}

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function restoreAuthSession(): Promise<AuthSession> {
  if (!(await isSecureStoreAvailable())) {
    return parseStoredSession(getWebSessionStorage()?.getItem(SESSION_KEY) ?? null);
  }

  const storedSession = await SecureStore.getItemAsync(SESSION_KEY);

  if (!storedSession) {
    cachedSession = emptyAuthSession;
    return cachedSession;
  }

  return parseStoredSession(storedSession);
}

export function getAuthSession(): AuthSession {
  return cachedSession;
}

export async function saveAuthSession(nextSession: AuthSession): Promise<void> {
  cachedSession = nextSession;

  if (nextSession.tokens) {
    await secureTokenStore.setTokens(nextSession.tokens);
  }

  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextSession));
  } else {
    getWebSessionStorage()?.setItem(SESSION_KEY, JSON.stringify(nextSession));
  }

  notifySessionListeners();
}

export async function clearAuthSession(): Promise<void> {
  cachedSession = emptyAuthSession;
  await secureTokenStore.clear();

  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } else {
    getWebSessionStorage()?.removeItem(SESSION_KEY);
  }

  notifySessionListeners();
}

export async function updateStoredAccessToken(accessToken: string): Promise<void> {
  if (!cachedSession.tokens) {
    return;
  }

  cachedSession = {
    ...cachedSession,
    tokens: {
      ...cachedSession.tokens,
      accessToken,
    },
  };
  await secureTokenStore.setAccessToken(accessToken);

  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(cachedSession));
  } else {
    getWebSessionStorage()?.setItem(SESSION_KEY, JSON.stringify(cachedSession));
  }

  notifySessionListeners();
}

async function parseStoredSession(storedSession: string | null): Promise<AuthSession> {
  if (!storedSession) {
    cachedSession = emptyAuthSession;
    return cachedSession;
  }

  try {
    cachedSession = JSON.parse(storedSession) as AuthSession;
    return cachedSession;
  } catch {
    await clearAuthSession();
    return emptyAuthSession;
  }
}
