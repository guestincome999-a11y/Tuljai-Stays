import { ApiClient, readPublicEnvironment } from '@tuljai/shared';
import type { RefreshTokenResponse } from '@tuljai/types';

import { updateStoredAccessToken } from '../auth/auth-session-store';
import { secureTokenStore } from '../auth/secure-token-store';
import { getOrCreateDeviceId } from '../device/device-identity';

const environment = readPublicEnvironment({
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
});
const publicApiClient = new ApiClient({ baseUrl: environment.apiBaseUrl });

let ownerRefreshPromise: Promise<string | null> | null = null;

async function refreshOwnerAccessToken(): Promise<string | null> {
  if (ownerRefreshPromise) {
    return ownerRefreshPromise;
  }

  ownerRefreshPromise = (async () => {
    const refreshToken = await secureTokenStore.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await publicApiClient.post<RefreshTokenResponse>('/auth/refresh-token', {
        deviceId: await getOrCreateDeviceId(),
        refreshToken,
      });
      await updateStoredAccessToken(response.accessToken);
      return response.accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    ownerRefreshPromise = null;
  });

  return ownerRefreshPromise;
}

export const apiClient = new ApiClient({
  baseUrl: environment.apiBaseUrl,
  getAccessToken: () => secureTokenStore.getAccessToken(),
  refreshAccessToken: refreshOwnerAccessToken,
});
