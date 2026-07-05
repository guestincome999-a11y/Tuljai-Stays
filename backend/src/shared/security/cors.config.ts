const DEVELOPMENT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:8081',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4000',
  'http://127.0.0.1:8081',
];

export function parseAllowedOrigins(value: string | undefined, nodeEnv: string): string[] {
  const configuredOrigins = value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins?.length) {
    return Array.from(new Set(configuredOrigins));
  }

  return nodeEnv === 'production' ? [] : DEVELOPMENT_ALLOWED_ORIGINS;
}

export function isCorsOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

export function resolveSocketCorsOrigins(): string[] {
  return parseAllowedOrigins(process.env.ALLOWED_ORIGINS, process.env.NODE_ENV ?? 'development');
}
