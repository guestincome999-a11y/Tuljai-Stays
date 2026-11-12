import { type NextRequest, NextResponse } from 'next/server';

import { resolveAdminApiBaseUrl } from '../../../src/config/api-base-url';

const COOKIE = 'tuljai-admin-refresh';
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth-session',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCredentials(value: unknown): { deviceId: string; refreshToken: string } | null {
  if (
    !isRecord(value) ||
    typeof value.deviceId !== 'string' ||
    !value.deviceId ||
    value.deviceId.length > 128 ||
    typeof value.refreshToken !== 'string' ||
    !value.refreshToken ||
    value.refreshToken.length > 4096
  )
    return null;
  return { deviceId: value.deviceId, refreshToken: value.refreshToken };
}

async function handle(request: NextRequest): Promise<NextResponse> {
  // Cookie-authenticated mutations are only allowed from this exact origin.
  const expectedOrigin = process.env.ADMIN_PUBLIC_ORIGIN ?? `${request.nextUrl.protocol}//${request.headers.get('host') ?? request.nextUrl.host}`;
  if (request.headers.get('origin') !== expectedOrigin) {
    return NextResponse.json({ message: 'Invalid origin' }, { status: 403 });
  }
  try {
    const stored = request.cookies.get(COOKIE)?.value;
    const rawCredentials: unknown =
      request.method === 'POST' ? await request.json() : stored ? JSON.parse(stored) : null;
    const credentials = parseCredentials(rawCredentials);
    if (!credentials) {
      if (request.method === 'DELETE') return NextResponse.json({ success: true });
      return NextResponse.json({ message: 'Session unavailable' }, { status: 401 });
    }
    const baseUrl = resolveAdminApiBaseUrl().replace(/\/$/u, '');
    const refreshed = await fetch(`${baseUrl}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      cache: 'no-store',
    });
    if (!refreshed.ok && refreshed.status !== 401) {
      return NextResponse.json({ message: 'Session service unavailable' }, { status: 503 });
    }
    const payload: unknown = refreshed.ok ? await refreshed.json() : null;
    const tokens: unknown = isRecord(payload) && 'data' in payload ? payload.data : payload;
    if (
      refreshed.ok &&
      (!isRecord(tokens) ||
        typeof tokens.accessToken !== 'string' ||
        typeof tokens.sessionExpiresAt !== 'string' ||
        typeof tokens.expiresInSeconds !== 'number')
    ) {
      return NextResponse.json({ message: 'Invalid session response' }, { status: 502 });
    }
    if (request.method === 'DELETE' && refreshed.ok) {
      const revoked = await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${isRecord(tokens) ? String(tokens.accessToken) : ''}`,
        },
        body: JSON.stringify(credentials),
        cache: 'no-store',
      });
      if (!revoked.ok) return NextResponse.json({ message: 'Logout failed' }, { status: 503 });
    }
    const response = NextResponse.json(
      request.method === 'PATCH' && refreshed.ok ? tokens : { success: refreshed.ok },
      {
        status: request.method === 'DELETE' || refreshed.ok ? 200 : 401,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
    if (request.method === 'DELETE' || !refreshed.ok) {
      response.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 });
    } else if (request.method === 'POST') {
      // Use the backend's original deadline. Refresh never rewrites this cookie.
      const expires = new Date(isRecord(tokens) ? String(tokens.sessionExpiresAt) : '');
      if (!Number.isFinite(expires.getTime()))
        return NextResponse.json({ message: 'Missing session deadline' }, { status: 502 });
      response.cookies.set(COOKIE, JSON.stringify(credentials), { ...cookieOptions, expires });
    }
    return response;
  } catch {
    return NextResponse.json({ message: 'Session service unavailable' }, { status: 503 });
  }
}

export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
