import { ApiClient } from '@tuljai/shared';
import type { RefreshTokenResponse } from '@tuljai/types';

import { deviceId, readAccessToken, readRefreshToken, updateAccessToken } from './session';

const PRODUCTION_API_BASE_URL = 'https://tuljai-stays-backend.onrender.com/api';

export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return configured && configured.length > 0 ? configured : PRODUCTION_API_BASE_URL;
}

let sessionExpiredHandler: (() => void) | null = null;

/** The auth provider registers this so a failed token refresh can send the person back to sign-in. */
export function onSessionExpired(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

const refreshClient = new ApiClient({ baseUrl: apiBaseUrl() });
let refreshInFlight: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    const refreshToken = await readRefreshToken();
    if (!refreshToken) return null;
    try {
      const response = await refreshClient.post<RefreshTokenResponse>('/auth/refresh-token', {
        deviceId: await deviceId(),
        refreshToken,
      });
      await updateAccessToken(response.accessToken);
      return response.accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/**
 * The server sleeps when nobody has used it for a while and can take up to a minute to wake.
 * Asking for /health the moment the app opens starts that wake-up while the first screen draws.
 */
export function warmUpBackend(): void {
  void fetch(`${apiBaseUrl()}/health`, { method: 'GET' }).catch(() => undefined);
}

export const api = new ApiClient({
  baseUrl: apiBaseUrl(),
  getAccessToken: readAccessToken,
  onSessionExpired: () => sessionExpiredHandler?.(),
  refreshAccessToken,
});
