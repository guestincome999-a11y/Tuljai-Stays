type Listener = () => void;

let unreadCount = 0;
const listeners = new Set<Listener>();

export function getNotificationUnreadCount() {
  return unreadCount;
}

export function setNotificationUnreadCount(nextCount: number) {
  unreadCount = Math.max(0, nextCount);
  listeners.forEach((listener) => listener());
}

export function subscribeNotificationUnreadCount(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
