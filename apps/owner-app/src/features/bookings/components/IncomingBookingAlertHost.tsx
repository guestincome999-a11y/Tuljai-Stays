import type { OwnerBookingSummary } from '@tuljai/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import {
  type BookingAlertSignal,
  subscribeToBookingAlerts,
} from '../../../notifications/booking-alert-events';
import { getEventBookingId } from '../../../realtime/realtime-events';
import { useRealtime } from '../../../realtime/realtime-provider';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { listOwnerBookings } from '../api/owner-bookings-api';
import { useOwnerBookingActions } from '../hooks/useOwnerBookings';

import { IncomingBookingAlert } from './IncomingBookingAlert';
import { RejectBookingModal } from './RejectBookingModal';

export function IncomingBookingAlertHost() {
  const assignedLodges = useAssignedLodges();
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const handledBookingIdsRef = useRef(new Set<string>());
  const isPollingRef = useRef(false);
  const [alertBooking, setAlertBooking] = useState<OwnerBookingSummary | null>(null);
  const [rejectBooking, setRejectBooking] = useState<OwnerBookingSummary | null>(null);

  const closeAlert = useCallback(() => {
    setAlertBooking(null);
    setRejectBooking(null);
  }, []);

  const actions = useOwnerBookingActions(closeAlert);

  const loadBookingAlert = useCallback(
    async ({ bookingId, lodgeId: requestedLodgeId, receivedAt }: BookingAlertSignal) => {
      const lodgeId = requestedLodgeId ?? assignedLodges.selectedLodge?.id ?? null;
      if (!lodgeId || isOffline) {
        return;
      }

      const requestKey = bookingId || `event:${receivedAt}`;

      if (handledBookingIdsRef.current.has(requestKey)) {
        return;
      }

      handledBookingIdsRef.current.add(requestKey);

      const response = await listOwnerBookings({
        limit: 10,
        lodgeId,
        page: 1,
        status: 'PENDING_OWNER_APPROVAL',
      }).catch(() => null);

      if (!response) {
        handledBookingIdsRef.current.delete(requestKey);
        return;
      }

      const nextBooking = response.items.find((booking) => booking.id === bookingId) ?? null;

      if (!nextBooking) {
        return;
      }

      setAlertBooking(nextBooking);
    },
    [assignedLodges.selectedLodge?.id, isOffline],
  );

  const pollPendingBookings = useCallback(async () => {
    const lodgeId = assignedLodges.selectedLodge?.id ?? null;

    if (!lodgeId || isOffline || isPollingRef.current || alertBooking || rejectBooking) {
      return;
    }

    isPollingRef.current = true;

    try {
      const response = await listOwnerBookings({
        limit: 30,
        lodgeId,
        page: 1,
        status: 'PENDING_OWNER_APPROVAL',
      });
      const nextBooking =
        response.items.find((booking) => !handledBookingIdsRef.current.has(booking.id)) ?? null;

      if (!nextBooking) {
        return;
      }

      handledBookingIdsRef.current.add(nextBooking.id);
      setAlertBooking(nextBooking);
    } catch {
      // Push and realtime delivery remain active while the next poll retries.
    } finally {
      isPollingRef.current = false;
    }
  }, [alertBooking, assignedLodges.selectedLodge?.id, isOffline, rejectBooking]);

  useEffect(() => {
    if (!assignedLodges.selectedLodge?.id || isOffline) {
      return undefined;
    }

    void pollPendingBookings();
    const interval = setInterval(() => {
      void pollPendingBookings();
    }, 5_000);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void pollPendingBookings();
      }
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [assignedLodges.selectedLodge?.id, isOffline, pollPendingBookings]);

  useEffect(() => {
    const event = realtime.lastBookingRequest;

    if (!event) {
      return;
    }

    const nestedNotification = isRecord(event.payload.notification)
      ? event.payload.notification
      : null;
    const bookingId =
      getEventBookingId(event) ??
      (typeof nestedNotification?.bookingId === 'string' ? nestedNotification.bookingId : null);

    if (!bookingId) {
      return;
    }

    void loadBookingAlert({
      bookingId,
      lodgeId:
        typeof event.payload.lodgeId === 'string'
          ? event.payload.lodgeId
          : typeof nestedNotification?.lodgeId === 'string'
            ? nestedNotification.lodgeId
            : null,
      receivedAt: event.receivedAt,
    });
  }, [loadBookingAlert, realtime.lastBookingRequest]);

  useEffect(
    () =>
      subscribeToBookingAlerts((signal) => {
        void loadBookingAlert(signal);
      }),
    [loadBookingAlert],
  );

  return (
    <>
      <IncomingBookingAlert
        booking={alertBooking}
        isOffline={isOffline}
        isSubmitting={Boolean(alertBooking && actions.submittingBookingId === alertBooking.id)}
        onAccept={(booking) => {
          void actions.accept(booking.id);
        }}
        onClose={closeAlert}
        onReject={(booking) => {
          setAlertBooking(null);
          setRejectBooking(booking);
        }}
      />
      <RejectBookingModal
        bookingCode={rejectBooking?.bookingCode ?? null}
        isSubmitting={Boolean(rejectBooking && actions.submittingBookingId === rejectBooking.id)}
        visible={Boolean(rejectBooking)}
        onCancel={() => setRejectBooking(null)}
        onConfirm={(reason) => {
          if (rejectBooking) {
            void actions.reject(rejectBooking.id, reason);
          }
        }}
      />
    </>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
