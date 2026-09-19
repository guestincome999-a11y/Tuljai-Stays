import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/auth-context';
import { refreshNotificationUnreadCount } from '../features/notifications/notification-count-store';
import { usePilgrimApp } from '../pilgrim-ui/PilgrimAppProvider';

import { registerExistingPilgrimPushToken, registerRotatedPilgrimPushToken } from './push-registration';

// The OS app-icon badge is written only by `PilgrimAppProvider`, from the
// shared unread-count store. This component never writes it: marking a tapped
// push as read goes through the provider (so the list, the bell and the badge
// all update), and a push arriving while the app is open just refreshes the
// count. Otherwise it only handles push registration and tap-to-navigate.
export function PilgrimPushNotifications() {
  const auth = useAuth();
  const router = useRouter();
  const { markNotificationRead } = usePilgrimApp();
  const handledResponseId = useRef<string | null>(null);
  // Latest provider action without re-subscribing the notification listeners
  // every time provider state changes.
  const markNotificationReadRef = useRef(markNotificationRead);
  markNotificationReadRef.current = markNotificationRead;

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
      await markNotificationReadRef.current(notificationId).catch(() => undefined);
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
    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      void refreshNotificationUnreadCount();
    });
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
      receivedSubscription.remove();
      responseSubscription.remove();
      tokenSubscription.remove();
    };
  }, [auth.isAuthenticated, handleResponse]);

  return null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
