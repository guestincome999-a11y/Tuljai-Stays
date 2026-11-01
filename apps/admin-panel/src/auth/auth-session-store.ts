import { emptyAuthSession, type AuthSession } from '@tuljai/shared';

const SESSION_STORAGE_KEY = 'tuljai.admin.session';

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getAuthSession(): AuthSession {
  if (!canUseBrowserStorage()) {
    return emptyAuthSession;
  }

  const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!stored) {
    return emptyAuthSession;
  }

  try {
    const session = JSON.parse(stored) as AuthSession;
    const deadline = session.activeSession?.sessionExpiresAt ?? session.tokens?.sessionExpiresAt;
    if (deadline && new Date(deadline).getTime() <= Date.now()) {
      clearAuthSession();
      return emptyAuthSession;
    }
    return session;
  } catch {
    clearAuthSession();
    return emptyAuthSession;
  }
}

export function setAuthSession(nextSession: AuthSession): void {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      ...nextSession,
      tokens: nextSession.tokens
        ? { ...nextSession.tokens, refreshToken: 'http-only-cookie' }
        : null,
    }),
  );
}

export function clearAuthSession(): void {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
