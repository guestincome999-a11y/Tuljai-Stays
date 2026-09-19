import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/auth-context';
import { markNotificationRead } from '../features/notifications/api/notifications-api';
import { refreshNotificationUnreadCount } from '../features/notifications/notification-count-store';

import { registerExistingPilgrimPushToken, registerRotatedPilgrimPushToken } from './push-registration';

// The OS app-icon badge is written only by `PilgrimAppProvider`, which mirrors
// the shared unread-count store. This component never writes the badge; when
// a tapped push marks a notification read it just refreshes that store, so
// the icon can't be left on the old number. It handles push registration and
// acting on a tapped push notification (marking it read and navigating).
export function PilgrimPushNotifications() {
  const auth = useAuth();
  const router = useRouter();
  const handledResponseId = useRef<string | null>(null);

  const handleResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    const responseId = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handledResponseId.current === responseId) {
      return;
    }

    handledResponseId.current = responseId;
    await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    const data = response.notification.request.content.data ?? {};
    const notificationId = readString(data.notificationId);

    if (notificationId) {
      await markNotificationRead(notificationId).catch(() => undefined);
      await refreshNotificationUnreadCount();
    }

    const type = readString(data.type);
    const bookingId = readString(data.bookingId);
    const announcementId = readString(data.announcementId);
    const lodgeId = readString(data.lodgeId);
    const roomId = readString(data.roomId);
    const roomTypeId = readString(data.roomTypeId);

    if (announcementId || type === 'ADMIN_ANNOUNCEMENT' || type === 'EMERGENCY_ALERT') {
      router.push({
        pathname: '/(app)/announcements',
        params: announcementId ? { announcementId } : {},
      });
      return;
    }

    if (type === 'QR_GENERATED' && bookingId) {
      router.push({
        pathname: '/(app)/pass',
        params: { bookingId },
      });
      return;
    }

    if (bookingId) {
      router.push({
        pathname: '/(app)/bookings/[id]',
        params: { id: bookingId },
      });
      return;
    }

    if (lodgeId && (roomId || roomTypeId)) {
      router.push({
        pathname: '/(app)/lodges/[id]',
        params: {
          id: lodgeId,
          ...(roomId ? { roomId } : {}),
          ...(roomTypeId ? { roomTypeId } : {}),
        },
      });
      return;
    }

    router.push('/(app)/notifications');
  }, [router]);

  useEffect(() => {
    if (!auth.isAuthenticated) {
      return undefined;
    }

    void registerExistingPilgrimPushToken().catch(() => false);

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void handleResponse(response);
      },
    );
    const tokenSubscription = Notifications.addPushTokenListener((token) => {
      void registerRotatedPilgrimPushToken(token).catch(() => false);
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void registerExistingPilgrimPushToken().catch(() => false);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        void handleResponse(response);
      }
    });

    return () => {
      appStateSubscription.remove();
      responseSubscription.remove();
      tokenSubscription.remove();
    };
  }, [auth.isAuthenticated, handleResponse]);

  return null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
