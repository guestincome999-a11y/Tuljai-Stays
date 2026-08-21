import type { BookingStatus, OwnerBookingSummary } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { getEventBookingId } from '../../../realtime/realtime-events';
import { useRealtime } from '../../../realtime/realtime-provider';
import { acceptOwnerBooking, listOwnerBookings, rejectOwnerBooking } from '../api/owner-bookings-api';

interface OwnerBookingsState {
  data: OwnerBookingSummary[];
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  totalItems: number;
}

export function useOwnerBookings(lodgeId: string | null, status: BookingStatus) {
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const [state, setState] = useState<OwnerBookingsState>({ data: [], errorMessage: null, isLoading: true, isRefreshing: false, totalItems: 0 });

  const load = useCallback(async (refreshing = false) => {
    if (!lodgeId) {
      setState({ data: [], errorMessage: null, isLoading: false, isRefreshing: false, totalItems: 0 });
      return;
    }
    setState((current) => ({ ...current, errorMessage: null, isLoading: !refreshing && current.data.length === 0, isRefreshing: refreshing }));
    if (isOffline) {
      setState((current) => ({ ...current, errorMessage: 'Connect to the internet to load latest bookings.', isLoading: false, isRefreshing: false }));
      return;
    }
    try {
      const result = await listOwnerBookings({ limit: 30, lodgeId, page: 1, status });
      setState({ data: result.items, errorMessage: null, isLoading: false, isRefreshing: false, totalItems: result.totalItems });
    } catch {
      setState((current) => ({ ...current, errorMessage: 'Bookings could not be loaded. Please try again.', isLoading: false, isRefreshing: false }));
    }
  }, [isOffline, lodgeId, status]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const eventName = realtime.lastEvent?.name;
    if (eventName === 'booking:new' || eventName === 'owner:alert' || eventName === 'booking:accepted' || eventName === 'booking:cancelled' || eventName === 'booking:rejected' || eventName === 'booking:expired' || eventName === 'booking:updated' || eventName === 'checkin:completed' || eventName === 'checkout:completed' || eventName === 'room:availability-updated' || eventName === 'room:status-updated') {
      const timeout = setTimeout(() => { void load(true); }, getEventBookingId(realtime.lastEvent) ? 500 : 1000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [load, realtime.lastEvent]);

  useEffect(() => {
    if (realtime.connectionRevision === 0) return;
    void load(true);
  }, [load, realtime.connectionRevision]);

  useEffect(() => {
    if (realtime.connected || isOffline || !lodgeId) return undefined;
    const interval = setInterval(() => void load(true), 30_000);
    return () => clearInterval(interval);
  }, [isOffline, load, lodgeId, realtime.connected]);

  return useMemo(() => ({ ...state, refresh: () => load(true) }), [load, state]);
}

export function useOwnerBookingActions(onCompleted: () => void) {
  const { isOffline } = useConnectivity();
  const [submittingBookingId, setSubmittingBookingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const accept = useCallback(async (bookingId: string) => {
    if (isOffline) { setErrorMessage('Connect to the internet to respond to bookings.'); return false; }
    setSubmittingBookingId(bookingId); setErrorMessage(null); setSuccessMessage(null);
    try { await acceptOwnerBooking(bookingId); setSuccessMessage('Booking accepted successfully.'); onCompleted(); return true; }
    catch { setErrorMessage('This room is no longer available. Please refresh bookings.'); return false; }
    finally { setSubmittingBookingId(null); }
  }, [isOffline, onCompleted]);

  const reject = useCallback(async (bookingId: string, reason: string) => {
    if (isOffline) { setErrorMessage('Connect to the internet to respond to bookings.'); return false; }
    setSubmittingBookingId(bookingId); setErrorMessage(null); setSuccessMessage(null);
    try { await rejectOwnerBooking(bookingId, reason); setSuccessMessage('Booking rejected.'); onCompleted(); return true; }
    catch { setErrorMessage('Booking could not be rejected. Please try again.'); return false; }
    finally { setSubmittingBookingId(null); }
  }, [isOffline, onCompleted]);

  return { accept, errorMessage, isOffline, reject, setSuccessMessage, submittingBookingId, successMessage };
}
