const PRODUCTION_API_BASE_URL = 'https://tuljai-stays-backend.onrender.com/api';

export function resolvePilgrimApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  return configuredUrl && configuredUrl.length > 0 ? configuredUrl : PRODUCTION_API_BASE_URL;
}
