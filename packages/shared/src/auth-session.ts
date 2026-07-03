import type { AuthTokens, AuthUserProfile, UserSession } from '@tuljai/types';

export interface AuthSession {
  activeSession: UserSession | null;
  tokens: AuthTokens | null;
  user: AuthUserProfile | null;
}

export const emptyAuthSession: AuthSession = {
  activeSession: null,
  tokens: null,
  user: null,
};

export interface TokenStorage {
  clear(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(tokens: AuthTokens): Promise<void>;
}
