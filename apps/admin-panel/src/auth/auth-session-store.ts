import { emptyAuthSession, type AuthSession } from '@tuljai/shared';

let session: AuthSession = emptyAuthSession;

export function getAuthSession(): AuthSession {
  return session;
}

export function setAuthSession(nextSession: AuthSession): void {
  session = nextSession;
}
