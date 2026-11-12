import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { notificationState } from '../../features/notifications/notification-count-store';
import { syncPilgrimNotificationBadge } from '../../notifications/push-registration';
import { useAuth } from '../core/auth';
import { useConnectivity } from '../core/connectivity';
import { usePreferences } from '../core/preferences';
import { promptForPushOnce, refreshPushRegistration } from '../core/push';

import { useGo } from './navigation';

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Registers this phone for notifications and opens the right screen when one is tapped. */
export function PushRouting() {
  const auth = useAuth();
  const { offline } = useConnectivity();
  useEffect(() => {
    void notificationState
      .activate(auth.signedIn ? (auth.user?.id ?? null) : null)
      .then(() => notificationState.refresh());
  }, [auth.signedIn, auth.user?.id]);
  useEffect(() => {
    if (!offline) void notificationState.refresh();
  }, [offline]);
  useEffect(
    () =>
      notificationState.subscribe(() => {
        const state = notificationState.getSnapshot();
        void syncPilgrimNotificationBadge(state.unreadCount, state.readIds).catch(
          (error: unknown) => console.warn('Notification badge update failed', error),
        );
      }),
    [],
  );
  const { bookingNotificationsEnabled } = usePreferences();
  const { push } = useGo();
  const handled = useRef<string | null>(null);

  const handleResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
      const responseId = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handled.current === responseId) return;
      handled.current = responseId;
      await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);

      const data: Record<string, unknown> = response.notification.request.content.data ?? {};
      const notificationId = readString(data['notificationId']);
      if (notificationId) {
        void notificationState.markRead(notificationId);
      }
      const type = readString(data['type']);
      const bookingId = readString(data['bookingId']);
      const lodgeId = readString(data['lodgeId']);

      if (
        readString(data['announcementId']) ||
        type === 'ADMIN_ANNOUNCEMENT' ||
        type === 'EMERGENCY_ALERT'
      ) {
        push('/announcements');
      } else if (bookingId) {
        push(`/booking/${bookingId}`);
      } else if (lodgeId) {
        push(`/lodge/${lodgeId}`);
      } else {
        push('/notifications');
      }
    },
    [push],
  );

  useEffect(() => {
    if (!auth.signedIn) return undefined;
    if (bookingNotificationsEnabled) void promptForPushOnce().catch(() => undefined);

    const responses = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response);
    });
    const received = Notifications.addNotificationReceivedListener(() => {
      void notificationState.refresh();
    });
    const tokens = Notifications.addPushTokenListener(() => {
      void refreshPushRegistration().catch(() => false);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void notificationState.refresh();
      if (state === 'active' && bookingNotificationsEnabled) {
        void refreshPushRegistration().catch(() => false);
      }
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) void handleResponse(response);
    });

    return () => {
      appState.remove();
      responses.remove();
      received.remove();
      tokens.remove();
    };
  }, [auth.signedIn, bookingNotificationsEnabled, handleResponse]);

  return null;
}
