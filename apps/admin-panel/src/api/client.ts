import { ApiClient, type ApiRequestOptions } from '@tuljai/shared';
import type { RefreshTokenResponse } from '@tuljai/types';

import {
  ADMIN_SESSION_EXPIRED_EVENT,
  ADMIN_SESSION_REFRESHED_EVENT,
  emitAdminSessionEvent,
} from '../auth/admin-session-events';
import { clearAuthSession, getAuthSession, setAuthSession } from '../auth/auth-session-store';
import { tokenStorage } from '../auth/token-storage';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? '';

const authenticatedClient = new ApiClient({
  baseUrl: apiBaseUrl,
  getAccessToken: () => tokenStorage.getAccessToken(),
});
const refreshClient = new ApiClient({ baseUrl: apiBaseUrl });
let refreshRequest: Promise<string | null> | null = null;

async function refreshAdminAccessToken(): Promise<string | null> {
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
    const refreshed = await refreshClient.post<RefreshTokenResponse>('/auth/refresh-token', {
      deviceId,
      refreshToken,
    });
    const nextTokens = {
      ...session.tokens,
      accessToken: refreshed.accessToken,
      expiresInSeconds: refreshed.expiresInSeconds,
    };
    const nextSession = { ...session, tokens: nextTokens };

    await tokenStorage.setTokens(nextTokens);
    setAuthSession(nextSession);
    emitAdminSessionEvent(ADMIN_SESSION_REFRESHED_EVENT);

    return refreshed.accessToken;
  } catch {
    await expireAdminSession();
    return null;
  }
}

async function expireAdminSession(): Promise<void> {
  clearAuthSession();
  await tokenStorage.clear();
  emitAdminSessionEvent(ADMIN_SESSION_EXPIRED_EVENT);
}

async function requestWithSessionRefresh<TResponse>(
  request: () => Promise<TResponse>,
): Promise<TResponse> {
  try {
    return await request();
  } catch (error) {
    if (!isUnauthorizedError(error)) {
      throw error;
    }

    const accessToken = await refreshAdminAccessToken();

    if (!accessToken) {
      throw error;
    }

    return request();
  }
}

function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('details' in error)) {
    return false;
  }

  const details = (error as { details?: unknown }).details;
  return Boolean(
    details &&
      typeof details === 'object' &&
      'statusCode' in details &&
      (details as { statusCode?: unknown }).statusCode === 401,
  );
}

export const apiClient = {
  get<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
    return requestWithSessionRefresh(() => authenticatedClient.get<TResponse>(path, options));
  },
  post<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return requestWithSessionRefresh(() => authenticatedClient.post<TResponse>(path, body));
  },
  request<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
    return requestWithSessionRefresh(() => authenticatedClient.request<TResponse>(path, options));
  },
};
