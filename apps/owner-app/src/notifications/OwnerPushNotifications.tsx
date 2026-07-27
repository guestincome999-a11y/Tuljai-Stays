import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '../auth/auth-context';
import {
  acceptOwnerBooking,
  rejectOwnerBooking,
} from '../features/bookings/api/owner-bookings-api';
import { markNotificationRead } from '../features/notifications/api/owner-notifications-api';

import { publishBookingAlert } from './booking-alert-events';
import {
  ACCEPT_BOOKING_ACTION,
  registerOwnerPushNotifications,
  REJECT_BOOKING_ACTION,
} from './push-registration';

export function OwnerPushNotifications() {
  const auth = useAuth();
  const router = useRouter();
  const handledResponseId = useRef<string | null>(null);

  const handleResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
      const responseId = response.notification.request.identifier;
      if (handledResponseId.current === responseId) {
        return;
      }

      handledResponseId.current = responseId;
      await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      const data = response.notification.request.content.data ?? {};
      const bookingId = typeof data.bookingId === 'string' ? data.bookingId : null;
      const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;

      if (!bookingId) {
        router.push('/(app)/notifications');
        return;
      }

      if (response.actionIdentifier === ACCEPT_BOOKING_ACTION) {
        const accepted = await acceptOwnerBooking(bookingId)
          .then(() => true)
          .catch(() => false);

        if (accepted && notificationId) {
          await markNotificationRead(notificationId).catch(() => undefined);
        }
        router.push({
          pathname: '/(app)/notifications',
          params: { actionResult: accepted ? 'accepted' : 'failed', bookingId },
        });
        return;
      }

      if (response.actionIdentifier === REJECT_BOOKING_ACTION) {
        const reason = response.userText?.trim() || 'Rejected from booking notification';
        const rejected = await rejectOwnerBooking(bookingId, reason)
          .then(() => true)
          .catch(() => false);

        if (rejected && notificationId) {
          await markNotificationRead(notificationId).catch(() => undefined);
        }
        router.push({
          pathname: '/(app)/notifications',
          params: { actionResult: rejected ? 'rejected' : 'failed', bookingId },
        });
        return;
      }

      router.push({
        pathname: '/(app)/notifications',
        params: { bookingId },
      });
    },
    [router],
  );

  useEffect(() => {
    if (!auth.isAuthenticated) {
      return;
    }

    void registerOwnerPushNotifications().catch(() => false);

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void handleResponse(response);
      },
    );
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data ?? {};
      const bookingId = typeof data.bookingId === 'string' ? data.bookingId : null;

      if (data.type === 'BOOKING_REQUEST' && bookingId) {
        publishBookingAlert({
          bookingId,
          lodgeId: typeof data.lodgeId === 'string' ? data.lodgeId : null,
          receivedAt: Date.now(),
        });
      }
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        void handleResponse(response);
      }
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [auth.isAuthenticated, handleResponse]);

  return null;
}
