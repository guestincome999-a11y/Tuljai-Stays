import { emptyAuthSession, type AuthSession } from '@tuljai/shared';
import * as SecureStore from 'expo-secure-store';

import { clearSelectedLodge } from '../features/lodges/storage/selected-lodge-store';

import { secureTokenStore } from './secure-token-store';

const SESSION_KEY = 'tuljai.owner.authSession';

let cachedSession: AuthSession = emptyAuthSession;

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function restoreAuthSession(): Promise<AuthSession> {
  if (!(await isSecureStoreAvailable())) {
    cachedSession = emptyAuthSession;
    return cachedSession;
  }

  const storedSession = await SecureStore.getItemAsync(SESSION_KEY);

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
  }
}

export async function clearAuthSession(): Promise<void> {
  cachedSession = emptyAuthSession;
  await secureTokenStore.clear();
  await clearSelectedLodge();

  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}
