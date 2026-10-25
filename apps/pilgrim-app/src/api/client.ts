import { ApiClient, readPublicEnvironment } from '@tuljai/shared';
import type { RefreshTokenResponse } from '@tuljai/types';

import { updateStoredAccessToken } from '../auth/auth-session-store';
import { secureTokenStore } from '../auth/secure-token-store';
import { resolvePilgrimApiBaseUrl } from '../config/api-base-url';
import { getOrCreateDeviceId } from '../device/device-identity';

const environment = readPublicEnvironment({
  EXPO_PUBLIC_API_BASE_URL: resolvePilgrimApiBaseUrl(),
});
const publicApiClient = new ApiClient({ baseUrl: environment.apiBaseUrl });

let pilgrimRefreshPromise: Promise<string | null> | null = null;

// Set by AuthProvider once it mounts so the module-level apiClient (which has no direct access to
// React state/navigation) can ask it to clear the session and route back to login when a token
// refresh fails.
let pilgrimSessionExpiredHandler: (() => void) | null = null;

export function setPilgrimSessionExpiredHandler(handler: (() => void) | null): void {
  pilgrimSessionExpiredHandler = handler;
}

async function refreshPilgrimAccessToken(): Promise<string | null> {
  if (pilgrimRefreshPromise) {
    return pilgrimRefreshPromise;
  }

  pilgrimRefreshPromise = (async () => {
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
    pilgrimRefreshPromise = null;
  });

  return pilgrimRefreshPromise;
}

export const apiClient = new ApiClient({
  baseUrl: environment.apiBaseUrl,
  getAccessToken: () => secureTokenStore.getAccessToken(),
  onSessionExpired: () => pilgrimSessionExpiredHandler?.(),
  refreshAccessToken: refreshPilgrimAccessToken,
});
