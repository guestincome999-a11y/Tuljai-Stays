import type { Booking } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { getEventBookingId } from '../../../realtime/realtime-events';
import { useRealtime } from '../../../realtime/realtime-provider';
import { getOwnerBooking } from '../api/owner-bookings-api';

interface OwnerBookingDetailState {
  data: Booking | null;
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export function useOwnerBookingDetail(bookingId: string | null) {
  const realtime = useRealtime();
  const [state, setState] = useState<OwnerBookingDetailState>({
    data: null,
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
  });

  const load = useCallback(
    async (refreshing = false) => {
      if (!bookingId) {
        setState({
          data: null,
          errorMessage: 'This booking could not be opened.',
          isLoading: false,
          isRefreshing: false,
        });
        return;
      }

      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && !current.data,
        isRefreshing: refreshing,
      }));

      try {
        const data = await getOwnerBooking(bookingId);
        setState({ data, errorMessage: null, isLoading: false, isRefreshing: false });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Booking details could not be loaded.',
          isLoading: false,
          isRefreshing: false,
        }));
      }
    },
    [bookingId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!bookingId || getEventBookingId(realtime.lastEvent) !== bookingId) {
      return;
    }

    void load(true);
  }, [bookingId, load, realtime.lastEvent]);

  useEffect(() => {
    if (realtime.connectionRevision > 0) {
      void load(true);
    }
  }, [load, realtime.connectionRevision]);

  return {
    ...state,
    refresh: () => load(true),
  };
}
