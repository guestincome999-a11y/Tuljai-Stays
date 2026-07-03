import type { AuthenticatedUser, AuthTokens } from '@tuljai/types';

export interface AuthSession {
  user: AuthenticatedUser | null;
  tokens: AuthTokens | null;
}

export const emptyAuthSession: AuthSession = {
  user: null,
  tokens: null,
};
