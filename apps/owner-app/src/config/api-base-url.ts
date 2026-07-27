const PRODUCTION_API_BASE_URL = 'https://tuljai-stays-backend.onrender.com/api';

export function resolveOwnerApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  return configuredUrl && configuredUrl.length > 0 ? configuredUrl : PRODUCTION_API_BASE_URL;
}
export function resolveOwnerApiUrl(path: string): string {
  const baseUrl = resolveOwnerApiBaseUrl().replace(/\/$/u, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseIncludesApiPrefix = /\/api$/u.test(baseUrl);
  const pathIncludesApiPrefix = normalizedPath === '/api' || normalizedPath.startsWith('/api/');

  if (baseIncludesApiPrefix && pathIncludesApiPrefix) {
    return `${baseUrl}${normalizedPath.replace(/^\/api/u, '')}`;
  }

  if (!baseIncludesApiPrefix && !pathIncludesApiPrefix) {
    return `${baseUrl}/api${normalizedPath}`;
  }

  return `${baseUrl}${normalizedPath}`;
}
