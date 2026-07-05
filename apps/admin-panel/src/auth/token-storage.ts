import type { TokenStorage } from '@tuljai/shared';
import type { AuthTokens } from '@tuljai/types';

const TOKEN_STORAGE_KEY = 'tuljai.admin.tokens';

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function readTokens(): AuthTokens | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const stored = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as AuthTokens;
  } catch {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
}

export const tokenStorage: TokenStorage = {
  clear(): Promise<void> {
    if (canUseBrowserStorage()) {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    return Promise.resolve();
  },
  getAccessToken(): Promise<string | null> {
    return Promise.resolve(readTokens()?.accessToken ?? null);
  },
  getRefreshToken(): Promise<string | null> {
    return Promise.resolve(readTokens()?.refreshToken ?? null);
  },
  setTokens(tokens: AuthTokens): Promise<void> {
    if (canUseBrowserStorage()) {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    }

    return Promise.resolve();
  },
};
