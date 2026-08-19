import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/auth-context';
import {
  getUnreadNotificationCount,
  markNotificationRead,
} from '../features/notifications/api/notifications-api';
import { setNotificationUnreadCount } from '../features/notifications/notification-count-store';
import { useRealtime } from '../realtime/realtime-provider';

import {
  registerExistingPilgrimPushToken,
  registerRotatedPilgrimPushToken,
  syncPilgrimNotificationBadge,
} from './push-registration';

export function PilgrimPushNotifications() {
  const auth = useAuth();
  const realtime = useRealtime();
  const router = useRouter();
  const handledResponseId = useRef<string | null>(null);

  const refreshBadge = useCallback(async () => {
    if (!auth.isAuthenticated) {
      setNotificationUnreadCount(0);
      await syncPilgrimNotificationBadge(0);
      return;
    }

    const result = await getUnreadNotificationCount().catch(() => null);
    if (result) {
      setNotificationUnreadCount(result.unreadCount);
      await syncPilgrimNotificationBadge(result.unreadCount);
    }
  }, [auth.isAuthenticated]);

  const handleResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
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
      }
      await refreshBadge();

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
    },
    [refreshBadge, router],
  );

  useEffect(() => {
    if (!auth.isAuthenticated) {
      setNotificationUnreadCount(0);
      void syncPilgrimNotificationBadge(0);
      return undefined;
    }

    void registerExistingPilgrimPushToken().catch(() => false);
    void refreshBadge();

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void handleResponse(response);
      },
    );
    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      void refreshBadge();
    });
    const tokenSubscription = Notifications.addPushTokenListener((token) => {
      void registerRotatedPilgrimPushToken(token).catch(() => false);
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void registerExistingPilgrimPushToken().catch(() => false);
        void refreshBadge();
      }
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
  }, [auth.isAuthenticated, handleResponse, refreshBadge]);

  useEffect(() => {
    const event = realtime.lastEvent;

    if (event?.name === 'notification:unread-count') {
      const unreadCount = event.payload.unreadCount;
      if (typeof unreadCount === 'number') {
        setNotificationUnreadCount(unreadCount);
        void syncPilgrimNotificationBadge(unreadCount);
      }
      return;
    }

    if (event?.name === 'notification:new') {
      void refreshBadge();
    }
  }, [realtime.lastEvent, refreshBadge]);

  return null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
