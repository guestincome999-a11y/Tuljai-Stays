import type { BookingStatus, OwnerBookingSummary } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { getEventBookingId } from '../../../realtime/realtime-events';
import { useRealtime } from '../../../realtime/realtime-provider';
import {
  acceptOwnerBooking,
  listOwnerBookings,
  rejectOwnerBooking,
} from '../api/owner-bookings-api';

const PAGE_SIZE = 30;

interface OwnerBookingsState {
  data: OwnerBookingSummary[];
  errorMessage: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  page: number;
  totalItems: number;
  totalPages: number;
}

export interface OwnerBookingsFilters {
  checkInFrom?: string;
  checkInTo?: string;
  order?: 'asc' | 'desc';
}

const emptyState: OwnerBookingsState = {
  data: [],
  errorMessage: null,
  isLoading: false,
  isLoadingMore: false,
  isRefreshing: false,
  page: 1,
  totalItems: 0,
  totalPages: 1,
};

export function useOwnerBookings(
  lodgeId: string | null,
  status: BookingStatus | null,
  filters: OwnerBookingsFilters = {},
) {
  const { checkInFrom, checkInTo, order } = filters;
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const [state, setState] = useState<OwnerBookingsState>({ ...emptyState, isLoading: true });

  const load = useCallback(
    async (refreshing = false) => {
      if (!lodgeId) {
        setState(emptyState);
        return;
      }
      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && current.data.length === 0,
        isRefreshing: refreshing,
      }));
      if (isOffline) {
        setState((current) => ({
          ...current,
          errorMessage: 'Connect to the internet to load latest bookings.',
          isLoading: false,
          isRefreshing: false,
        }));
        return;
      }
      try {
        const result = await listOwnerBookings({
          checkInFrom,
          checkInTo,
          limit: PAGE_SIZE,
          lodgeId,
          order,
          page: 1,
          status: status ?? undefined,
        });
        setState({
          data: result.items,
          errorMessage: null,
          isLoading: false,
          isLoadingMore: false,
          isRefreshing: false,
          page: result.page,
          totalItems: result.totalItems,
          totalPages: result.totalPages,
        });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Bookings could not be loaded. Please try again.',
          isLoading: false,
          isRefreshing: false,
        }));
      }
    },
    [checkInFrom, checkInTo, isOffline, lodgeId, order, status],
  );

  const loadMore = useCallback(async () => {
    if (!lodgeId || isOffline || state.isLoadingMore || state.page >= state.totalPages) {
      return;
    }
    const nextPage = state.page + 1;
    setState((current) => ({ ...current, errorMessage: null, isLoadingMore: true }));
    try {
      const result = await listOwnerBookings({
        checkInFrom,
        checkInTo,
        limit: PAGE_SIZE,
        lodgeId,
        order,
        page: nextPage,
        status: status ?? undefined,
      });
      setState((current) => ({
        ...current,
        data: [
          ...current.data,
          ...result.items.filter((item) => !current.data.some((existing) => existing.id === item.id)),
        ],
        isLoadingMore: false,
        page: result.page,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      }));
    } catch {
      setState((current) => ({
        ...current,
        errorMessage: 'More bookings could not be loaded. Please try again.',
        isLoadingMore: false,
      }));
    }
  }, [
    checkInFrom,
    checkInTo,
    isOffline,
    lodgeId,
    order,
    state.isLoadingMore,
    state.page,
    state.totalPages,
    status,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const eventName = realtime.lastEvent?.name;
    if (
      eventName === 'booking:new' ||
      eventName === 'owner:alert' ||
      eventName === 'booking:accepted' ||
      eventName === 'booking:cancelled' ||
      eventName === 'booking:rejected' ||
      eventName === 'booking:expired' ||
      eventName === 'booking:updated' ||
      eventName === 'checkin:completed' ||
      eventName === 'checkout:completed' ||
      eventName === 'room:availability-updated' ||
      eventName === 'room:status-updated'
    ) {
      const timeout = setTimeout(
        () => {
          void load(true);
        },
        getEventBookingId(realtime.lastEvent) ? 500 : 1000,
      );
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

  return useMemo(() => ({ ...state, loadMore, refresh: () => load(true) }), [load, loadMore, state]);
}

export function useOwnerBookingActions(onCompleted: () => void) {
  const { isOffline } = useConnectivity();
  const [submittingBookingId, setSubmittingBookingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const accept = useCallback(
    async (bookingId: string) => {
      if (isOffline) {
        setErrorMessage('Connect to the internet to respond to bookings.');
        return false;
      }
      setSubmittingBookingId(bookingId);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        await acceptOwnerBooking(bookingId);
        setSuccessMessage('Booking accepted successfully.');
        onCompleted();
        return true;
      } catch {
        setErrorMessage('This room is no longer available. Please refresh bookings.');
        return false;
      } finally {
        setSubmittingBookingId(null);
      }
    },
    [isOffline, onCompleted],
  );

  const reject = useCallback(
    async (bookingId: string, reason: string) => {
      if (isOffline) {
        setErrorMessage('Connect to the internet to respond to bookings.');
        return false;
      }
      setSubmittingBookingId(bookingId);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        await rejectOwnerBooking(bookingId, reason);
        setSuccessMessage('Booking rejected.');
        onCompleted();
        return true;
      } catch {
        setErrorMessage('Booking could not be rejected. Please try again.');
        return false;
      } finally {
        setSubmittingBookingId(null);
      }
    },
    [isOffline, onCompleted],
  );

  return {
    accept,
    errorMessage,
    isOffline,
    reject,
    setSuccessMessage,
    submittingBookingId,
    successMessage,
  };
}
