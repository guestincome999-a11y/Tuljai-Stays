'use client';

import type { Booking, BookingStatus } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { getAdminBooking, updateAdminBookingStatus } from '../api/admin-bookings-api';

interface AdminBookingDetailState {
  data: Booking | null;
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export function useAdminBookingDetail(bookingId: string) {
  const [state, setState] = useState<AdminBookingDetailState>({
    data: null,
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(
    async (refreshing = false) => {
      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && !current.data,
        isRefreshing: refreshing,
      }));

      try {
        const booking = await getAdminBooking(bookingId);
        setState({ data: booking, errorMessage: null, isLoading: false, isRefreshing: false });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Booking detail could not be loaded.',
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

  const updateStatus = useCallback(
    async (status: BookingStatus, notes: string) => {
      setIsSubmitting(true);
      setSuccessMessage(null);
      setState((current) => ({ ...current, errorMessage: null }));

      try {
        const booking = await updateAdminBookingStatus(bookingId, { notes, status });
        setState({ data: booking, errorMessage: null, isLoading: false, isRefreshing: false });
        setSuccessMessage('Booking status updated and audit trail created.');
        return true;
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Status update failed. Backend validation prevented this action.',
        }));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [bookingId],
  );

  return {
    ...state,
    isSubmitting,
    refresh: () => load(true),
    setSuccessMessage,
    successMessage,
    updateStatus,
  };
}
