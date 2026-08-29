import { ApiClient, readPublicEnvironment } from '@tuljai/shared';
import type { RefreshTokenResponse } from '@tuljai/types';

import { updateStoredAccessToken } from '../auth/auth-session-store';
import { secureTokenStore } from '../auth/secure-token-store';
import { resolveOwnerApiBaseUrl } from '../config/api-base-url';
import { getOrCreateDeviceId } from '../device/device-identity';

const environment = readPublicEnvironment({
  EXPO_PUBLIC_API_BASE_URL: resolveOwnerApiBaseUrl(),
});
const publicApiClient = new ApiClient({ baseUrl: environment.apiBaseUrl });

let ownerRefreshPromise: Promise<string | null> | null = null;

// Set by AuthProvider once it mounts so the module-level apiClient (which has no direct access to
// React state/navigation) can ask it to clear the session and route back to login when a token
// refresh fails. Kept as a simple settable slot rather than an event emitter since there is only
// ever one active owner-app auth session at a time.
let ownerSessionExpiredHandler: (() => void) | null = null;

export function setOwnerSessionExpiredHandler(handler: (() => void) | null): void {
  ownerSessionExpiredHandler = handler;
}

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
  onSessionExpired: () => ownerSessionExpiredHandler?.(),
  refreshAccessToken: refreshOwnerAccessToken,
});
