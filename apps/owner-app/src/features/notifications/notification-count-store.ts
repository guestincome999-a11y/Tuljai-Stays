import { getUnreadNotificationCount } from './api/owner-notifications-api';

type Listener = (unreadCount: number) => void;

let unreadCount = 0;
// Bumped on every write and every fetch start. A slower, older response can
// then never overwrite a newer count — that race is what left the badge
// "stuck" on a stale number after the last notification was read.
let writeVersion = 0;
const listeners = new Set<Listener>();

function publish(nextCount: number) {
  unreadCount = Math.max(0, Math.floor(nextCount));
  listeners.forEach((listener) => listener(unreadCount));
}

export function getNotificationUnreadCount() {
  return unreadCount;
}

export function setNotificationUnreadCount(nextCount: number) {
  writeVersion += 1;
  publish(nextCount);
}

/**
 * Reconciles the count with the server. On failure the last known count is
 * kept instead of being reset to 0.
 */
export async function refreshNotificationUnreadCount(): Promise<void> {
  writeVersion += 1;
  const requestVersion = writeVersion;
  try {
    const result = await getUnreadNotificationCount();
    if (requestVersion === writeVersion) publish(result.unreadCount);
  } catch {
    // Keep the last known count.
  }
}

export function subscribeNotificationUnreadCount(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
