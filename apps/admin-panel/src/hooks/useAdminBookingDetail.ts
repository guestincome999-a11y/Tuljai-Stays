'use client';

import type { AdminBookingSummary, BookingStatus } from '@tuljai/types';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getAdminBooking, updateAdminBookingStatus } from '../api/admin-bookings-api';
import {
  createAdminRealtimeSocket,
  subscribeAdminRealtimeEvents,
  subscribeAdminRealtimeSessionRecovery,
} from '../api/realtime-client';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { tokenStorage } from '../auth/token-storage';

interface AdminBookingDetailState {
  data: AdminBookingSummary | null;
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export function useAdminBookingDetail(bookingId: string) {
  const auth = useAdminAuth();
  const loadRevision = useRef(0);
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
      const revision = ++loadRevision.current;
      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && !current.data,
        isRefreshing: refreshing,
      }));

      try {
        const booking = await getAdminBooking(bookingId);
        if (revision !== loadRevision.current) return;
        setState({ data: booking, errorMessage: null, isLoading: false, isRefreshing: false });
      } catch {
        if (revision !== loadRevision.current) return;
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
    return () => {
      loadRevision.current++;
    };
  }, [load]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let active = true;
    let cleanup: (() => void) | undefined;
    void tokenStorage.getAccessToken().then((token) => {
      if (!active || !token) return;
      const socket = createAdminRealtimeSocket(token);
      socket.on('connect', () => void load(true));
      subscribeAdminRealtimeSessionRecovery(socket, () => auth.refreshSession());
      subscribeAdminRealtimeEvents(socket, (event) => {
        if (event.payload.bookingId && event.payload.bookingId !== bookingId) return;
        if (
          event.name.startsWith('booking:') ||
          event.name.startsWith('qr:') ||
          event.name === 'checkin:completed' ||
          event.name === 'checkout:completed' ||
          event.name === 'dashboard:update'
        )
          void load(true);
      });
      cleanup = () => socket.disconnect();
    });
    const refresh = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    const interval = setInterval(refresh, 45_000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      cleanup?.();
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [
    auth.isAuthenticated,
    auth.refreshSession,
    auth.session.tokens?.accessToken,
    bookingId,
    load,
  ]);

  const updateStatus = useCallback(
    async (status: BookingStatus, notes: string) => {
      setIsSubmitting(true);
      setSuccessMessage(null);
      setState((current) => ({ ...current, errorMessage: null }));

      try {
        await updateAdminBookingStatus(bookingId, { notes, status });
        const booking = await getAdminBooking(bookingId);
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
