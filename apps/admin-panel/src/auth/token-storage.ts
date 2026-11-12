
import type { TokenStorage } from '@tuljai/shared';
import type { AuthTokens } from '@tuljai/types';

import { getOrCreateAdminDeviceId } from './admin-device';

const TOKEN_STORAGE_KEY = 'tuljai.admin.tokens';

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readTokens(): AuthTokens | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as AuthTokens;
  } catch {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
}

export const tokenStorage: TokenStorage = {
  async clear(): Promise<void> {
    const response = await fetch('/api/auth-session', { method: 'DELETE' });
    if (!response.ok) throw new Error('Unable to revoke session. Please retry.');
    if (canUseBrowserStorage()) {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    return Promise.resolve();
  },
  getAccessToken(): Promise<string | null> {
    return Promise.resolve(readTokens()?.accessToken ?? null);
  },
  getRefreshToken(): Promise<string | null> {
    return Promise.resolve(readTokens()?.refreshToken ?? null);
  },
  async setTokens(tokens: AuthTokens): Promise<void> {
    if (tokens.refreshToken !== 'http-only-cookie') {
      const response = await fetch('/api/auth-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: tokens.refreshToken,
          deviceId: getOrCreateAdminDeviceId(),
        }),
      });
      if (!response.ok) throw new Error('Unable to persist session securely');
    }
    if (canUseBrowserStorage()) {
      window.localStorage.setItem(
        TOKEN_STORAGE_KEY,
        JSON.stringify({ ...tokens, refreshToken: 'http-only-cookie' }),
      );
    }

    return Promise.resolve();
  },
};
