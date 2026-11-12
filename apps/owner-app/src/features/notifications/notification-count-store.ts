import { createNotificationState, type NotificationSnapshot } from '@tuljai/shared';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { apiClient } from '../../api/client';

function cachePath(userId: string) {
  if (!FileSystem.documentDirectory) throw new Error('Notification storage unavailable');
  return FileSystem.documentDirectory + 'notifications-v2-' + encodeURIComponent(userId) + '.json';
}

export const notificationState = createNotificationState({
  scheduleRetry: (retry, delay) => {
    const timer = setTimeout(retry, delay);
    return () => clearTimeout(timer);
  },
  fetch: (type) =>
    apiClient.get<NotificationSnapshot>('/notifications', { params: { limit: 40, page: 1, type } }),
  mark: (ids) => apiClient.post<{ userId: string }>('/notifications/read-all', { ids }),
  read: async (userId) => {
    if (Platform.OS === 'web')
      return globalThis.localStorage.getItem('tuljai.owner.notifications.v2.' + userId);
    const path = cachePath(userId);
    // A completed temp write is the newest journal. Recover it if the app
    // stopped between replacing the old file and finishing the move.
    for (const candidate of [path + '.tmp', path]) {
      if (!(await FileSystem.getInfoAsync(candidate)).exists) continue;
      const value = await FileSystem.readAsStringAsync(candidate);
      try {
        JSON.parse(value);
        return value;
      } catch {
        /* Try the previous intact journal. */
      }
    }
    return null;
  },
  write: async (userId, value) => {
    if (Platform.OS === 'web') {
      globalThis.localStorage.setItem('tuljai.owner.notifications.v2.' + userId, value);
      return;
    }
    const path = cachePath(userId);
    await FileSystem.writeAsStringAsync(path + '.tmp', value);
    await FileSystem.moveAsync({ from: path + '.tmp', to: path });
  },
});

export const getNotificationUnreadCount = () => notificationState.getSnapshot().unreadCount;
export const refreshNotificationUnreadCount = notificationState.refresh;
export function subscribeNotificationUnreadCount(listener: (count: number) => void) {
  return notificationState.subscribe(() => listener(getNotificationUnreadCount()));
}
