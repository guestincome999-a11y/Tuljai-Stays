import type { AvailabilityResponse, BookingLock } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import {
  checkAvailability,
  createBooking,
  createBookingLock,
  getBooking,
  listMyBookings,
  type BookingLockRequest,
  type CreateBookingRequest,
  type EnrichedBooking,
} from '../api/bookings-api';

interface AsyncState<TData> {
  data: TData | null;
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export function useMyBookings() {
  const [state, setState] = useState<AsyncState<EnrichedBooking[]>>({
    data: null,
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
  });

  const load = useCallback(async (refreshing = false) => {
    setState((current) => ({
      ...current,
      errorMessage: null,
      isLoading: !refreshing && !current.data,
      isRefreshing: refreshing,
    }));

    try {
      const data = await listMyBookings();
      setState({ data, errorMessage: null, isLoading: false, isRefreshing: false });
    } catch {
      setState((current) => ({
        ...current,
        errorMessage: 'We could not load your bookings right now.',
        isLoading: false,
        isRefreshing: false,
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    ...state,
    refresh: () => load(true),
  };
}

export function useBookingDetail(bookingId: string | null) {
  const [state, setState] = useState<AsyncState<EnrichedBooking>>({
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
        const data = await getBooking(bookingId);
        setState({ data, errorMessage: null, isLoading: false, isRefreshing: false });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'We could not load this booking right now.',
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

  return {
    ...state,
    refresh: () => load(true),
  };
}

export function useBookingRequestFlow() {
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [bookingLock, setBookingLock] = useState<BookingLock | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const [isCreatingLock, setIsCreatingLock] = useState(false);

  return {
    availability,
    bookingLock,
    errorMessage,
    isCheckingAvailability,
    isCreatingBooking,
    isCreatingLock,
    resetError: () => setErrorMessage(null),
    runAvailabilityCheck: async (input: BookingLockRequest) => {
      setIsCheckingAvailability(true);
      setErrorMessage(null);

      try {
        const result = await checkAvailability(input);
        setAvailability(result);
        setBookingLock(null);

        return result;
      } catch {
        setAvailability(null);
        setErrorMessage('Availability could not be checked. Please try different dates.');
        return null;
      } finally {
        setIsCheckingAvailability(false);
      }
    },
    runBookingCreate: async (input: CreateBookingRequest) => {
      setIsCreatingBooking(true);
      setErrorMessage(null);

      try {
        return await createBooking(input);
      } catch {
        setErrorMessage('Booking request could not be sent. Please re-check availability.');
        return null;
      } finally {
        setIsCreatingBooking(false);
      }
    },
    runLockCreate: async (input: BookingLockRequest) => {
      setIsCreatingLock(true);
      setErrorMessage(null);

      try {
        const result = await createBookingLock(input);
        setBookingLock(result);

        return result;
      } catch {
        setBookingLock(null);
        setErrorMessage('This room could not be held. Please check availability again.');
        return null;
      } finally {
        setIsCreatingLock(false);
      }
    },
  };
}
