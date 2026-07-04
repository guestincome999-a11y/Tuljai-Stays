import type { OwnerBookingSummary } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
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
  const [alertBooking, setAlertBooking] = useState<OwnerBookingSummary | null>(null);
  const [rejectBooking, setRejectBooking] = useState<OwnerBookingSummary | null>(null);

  const closeAlert = useCallback(() => {
    setAlertBooking(null);
    setRejectBooking(null);
  }, []);

  const actions = useOwnerBookingActions(closeAlert);

  useEffect(() => {
    const event = realtime.lastEvent;
    const eventName = event?.name;

    if (!event || (eventName !== 'booking:new' && eventName !== 'owner:alert')) {
      return;
    }

    const lodgeId =
      typeof event.payload.lodgeId === 'string'
        ? event.payload.lodgeId
        : assignedLodges.selectedLodge?.id;

    if (!lodgeId || isOffline) {
      return;
    }

    const bookingId = getEventBookingId(event);

    async function loadAlertBooking() {
      const response = await listOwnerBookings({
        limit: 10,
        lodgeId,
        page: 1,
        status: 'PENDING_OWNER_APPROVAL',
      }).catch(() => null);

      if (!response) {
        return;
      }

      const nextBooking =
        response.items.find((booking) => booking.id === bookingId) ?? response.items[0] ?? null;

      setAlertBooking(nextBooking);
    }

    void loadAlertBooking();
  }, [assignedLodges.selectedLodge?.id, isOffline, realtime.lastEvent]);

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
        onReject={setRejectBooking}
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
