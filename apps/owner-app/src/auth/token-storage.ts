import type { TokenStorage } from '@tuljai/shared';
import type { AuthTokens } from '@tuljai/types';

let storedTokens: AuthTokens | null = null;

export const tokenStorage: TokenStorage = {
  clear(): Promise<void> {
    storedTokens = null;
    return Promise.resolve();
  },
  getAccessToken(): Promise<string | null> {
    return Promise.resolve(storedTokens?.accessToken ?? null);
  },
  getRefreshToken(): Promise<string | null> {
    return Promise.resolve(storedTokens?.refreshToken ?? null);
  },
  setTokens(tokens: AuthTokens): Promise<void> {
    storedTokens = tokens;
    return Promise.resolve();
  },
};
