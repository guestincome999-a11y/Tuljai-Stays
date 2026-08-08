import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/auth-context';
import {
  acceptOwnerBooking,
  rejectOwnerBooking,
} from '../features/bookings/api/owner-bookings-api';
import { saveSelectedLodgeId } from '../features/lodges/storage/selected-lodge-store';
import {
  getUnreadNotificationCount,
  markNotificationRead,
} from '../features/notifications/api/owner-notifications-api';
import { useRealtime } from '../realtime/realtime-provider';

import { publishBookingAlert } from './booking-alert-events';
import {
  ACCEPT_BOOKING_ACTION,
  registerOwnerPushNotifications,
  registerRotatedOwnerPushToken,
  REJECT_BOOKING_ACTION,
  syncOwnerNotificationBadge,
} from './push-registration';

export function OwnerPushNotifications() {
  const auth = useAuth();
  const realtime = useRealtime();
  const router = useRouter();
  const handledResponseId = useRef<string | null>(null);

  const refreshBadge = useCallback(async () => {
    if (!auth.isAuthenticated) {
      await syncOwnerNotificationBadge(0);
      return;
    }

    const result = await getUnreadNotificationCount().catch(() => null);
    if (result) {
      await syncOwnerNotificationBadge(result.unreadCount);
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
      const bookingId = readString(data.bookingId);
      const notificationId = readString(data.notificationId);

      if (response.actionIdentifier === ACCEPT_BOOKING_ACTION && bookingId) {
        const accepted = await acceptOwnerBooking(bookingId)
          .then(() => true)
          .catch(() => false);

        if (accepted && notificationId) {
          await markNotificationRead(notificationId).catch(() => undefined);
        }
        await refreshBadge();
        router.push({
          pathname: '/(app)/bookings/[id]',
          params: { actionResult: accepted ? 'accepted' : 'failed', id: bookingId },
        });
        return;
      }

      if (response.actionIdentifier === REJECT_BOOKING_ACTION && bookingId) {
        const reason = response.userText?.trim() || 'Rejected from booking notification';
        const rejected = await rejectOwnerBooking(bookingId, reason)
          .then(() => true)
          .catch(() => false);

        if (rejected && notificationId) {
          await markNotificationRead(notificationId).catch(() => undefined);
        }
        await refreshBadge();
        router.push({
          pathname: '/(app)/bookings/[id]',
          params: { actionResult: rejected ? 'rejected' : 'failed', id: bookingId },
        });
        return;
      }

      if (notificationId) {
        await markNotificationRead(notificationId).catch(() => undefined);
      }
      await refreshBadge();

      const type = readString(data.type);
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

      if (roomId || roomTypeId) {
        if (lodgeId) {
          await saveSelectedLodgeId(lodgeId).catch(() => undefined);
        }
        router.push({
          pathname: '/(app)/rooms',
          params: {
            ...(lodgeId ? { lodgeId } : {}),
            ...(roomId ? { roomId } : {}),
            ...(roomTypeId ? { roomTypeId } : {}),
          },
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

      router.push('/(app)/notifications');
    },
    [refreshBadge, router],
  );

  useEffect(() => {
    if (!auth.isAuthenticated) {
      void syncOwnerNotificationBadge(0);
      return undefined;
    }

    void registerOwnerPushNotifications().catch(() => false);
    void refreshBadge();

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void handleResponse(response);
      },
    );
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data ?? {};
      const bookingId = readString(data.bookingId);

      if (data.type === 'BOOKING_REQUEST' && bookingId) {
        publishBookingAlert({
          bookingId,
          lodgeId: readString(data.lodgeId),
          receivedAt: Date.now(),
        });
      }
      void refreshBadge();
    });
    const tokenSubscription = Notifications.addPushTokenListener((token) => {
      void registerRotatedOwnerPushToken(token).catch(() => false);
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void registerOwnerPushNotifications().catch(() => false);
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
        void syncOwnerNotificationBadge(unreadCount);
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
