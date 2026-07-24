export const ADMIN_SESSION_EXPIRED_EVENT = 'tuljai:admin-session-expired';
export const ADMIN_SESSION_REFRESHED_EVENT = 'tuljai:admin-session-refreshed';

export function emitAdminSessionEvent(eventName: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(eventName));
  }
}
