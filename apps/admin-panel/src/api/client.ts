import { ApiClient } from '@tuljai/shared';
import type { RefreshTokenResponse } from '@tuljai/types';
import { ApplicationError } from '@tuljai/utils';

import {
  ADMIN_SESSION_EXPIRED_EVENT,
  ADMIN_SESSION_REFRESHED_EVENT,
  emitAdminSessionEvent,
} from '../auth/admin-session-events';
import { clearAuthSession, getAuthSession, setAuthSession } from '../auth/auth-session-store';
import { tokenStorage } from '../auth/token-storage';
import { resolveAdminApiBaseUrl } from '../config/api-base-url';

const apiBaseUrl = resolveAdminApiBaseUrl();

const authenticatedClient = new ApiClient({
  baseUrl: apiBaseUrl,
  getAccessToken: () => tokenStorage.getAccessToken(),
  refreshAccessToken: refreshAdminAccessToken,
});
let refreshRequest: Promise<string | null> | null = null;

export async function refreshAdminAccessToken(): Promise<string | null> {
  if (refreshRequest) {
    return refreshRequest;
  }

  refreshRequest = performAdminAccessTokenRefresh().finally(() => {
    refreshRequest = null;
  });

  return refreshRequest;
}

async function performAdminAccessTokenRefresh(): Promise<string | null> {
  const session = getAuthSession();
  const refreshToken = session.tokens?.refreshToken;
  const deviceId = session.activeSession?.deviceId;

  if (!refreshToken || !deviceId || !session.tokens) {
    await expireAdminSession();
    return null;
  }

  try {
    const response = await fetch('/api/auth-session', { method: 'PATCH' });
    if (!response.ok)
      throw new ApplicationError('Session refresh failed', 'AUTH_REFRESH_FAILED', {
        statusCode: response.status,
      });
    const refreshed = (await response.json()) as RefreshTokenResponse;
    const nextTokens = {
      ...session.tokens,
      accessToken: refreshed.accessToken,
      expiresInSeconds: refreshed.expiresInSeconds,
      sessionExpiresAt: refreshed.sessionExpiresAt,
    };
    const nextSession = { ...session, tokens: nextTokens };

    await tokenStorage.setTokens(nextTokens);
    setAuthSession(nextSession);
    emitAdminSessionEvent(ADMIN_SESSION_REFRESHED_EVENT);

    return refreshed.accessToken;
  } catch (error) {
    if (error instanceof ApplicationError && error.details.statusCode === 401) {
      await expireAdminSession();
      return null;
    }
    throw error;
  }
}

async function expireAdminSession(): Promise<void> {
  clearAuthSession();
  await tokenStorage.clear();
  emitAdminSessionEvent(ADMIN_SESSION_EXPIRED_EVENT);
}

export const apiClient = authenticatedClient;
