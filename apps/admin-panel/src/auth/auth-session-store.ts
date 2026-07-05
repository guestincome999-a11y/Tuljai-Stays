import { emptyAuthSession, type AuthSession } from '@tuljai/shared';

const SESSION_STORAGE_KEY = 'tuljai.admin.session';

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function getAuthSession(): AuthSession {
  if (!canUseBrowserStorage()) {
    return emptyAuthSession;
  }

  const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

  if (!stored) {
    return emptyAuthSession;
  }

  try {
    return JSON.parse(stored) as AuthSession;
  } catch {
    clearAuthSession();
    return emptyAuthSession;
  }
}

export function setAuthSession(nextSession: AuthSession): void {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
}

export function clearAuthSession(): void {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
