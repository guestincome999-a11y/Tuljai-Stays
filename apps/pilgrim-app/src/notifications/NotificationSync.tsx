import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/auth-context';
import { useConnectivity } from '../connectivity/connectivity-context';
import { notificationState } from '../features/notifications/notification-count-store';
import { useRealtime } from '../realtime/realtime-provider';

import { syncPilgrimNotificationBadge } from './push-registration';

export function NotificationSync() {
  const auth = useAuth();
  const realtime = useRealtime();
  const { isOffline } = useConnectivity();
  const userId = auth.isAuthenticated ? (auth.user?.id ?? null) : null;
  useEffect(() => {
    void notificationState.activate(userId).then(() => notificationState.refresh());
  }, [userId]);
  useEffect(() => {
    if (!isOffline) void notificationState.refresh();
  }, [isOffline, realtime.connectionRevision]);
  useEffect(() => {
    if (realtime.lastEvent?.name.startsWith('notification:')) void notificationState.refresh();
  }, [realtime.lastEvent]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void notificationState.refresh();
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const update = () => {
      const state = notificationState.getSnapshot();
      void syncPilgrimNotificationBadge(state.unreadCount, state.readIds).catch((error: unknown) =>
        console.warn('Notification badge update failed', error),
      );
    };
    update();
    return notificationState.subscribe(update);
  }, []);
  return null;
}
