import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { api } from '../core/api';
import { useAuth } from '../core/auth';
import { usePreferences } from '../core/preferences';
import { promptForPushOnce, refreshPushRegistration } from '../core/push';

import { useGo } from './navigation';

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Registers this phone for notifications and opens the right screen when one is tapped. */
export function PushRouting() {
  const auth = useAuth();
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
        await api.post(`/notifications/${notificationId}/read`).catch(() => undefined);
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
    const tokens = Notifications.addPushTokenListener(() => {
      void refreshPushRegistration().catch(() => false);
    });
    const appState = AppState.addEventListener('change', (state) => {
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
      tokens.remove();
    };
  }, [auth.signedIn, bookingNotificationsEnabled, handleResponse]);

  return null;
}
