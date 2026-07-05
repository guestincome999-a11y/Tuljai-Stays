'use client';

import type { AdminBookingSummary, BookingStatus, PaginatedResponse } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { listAdminBookings, type AdminBookingsQuery } from '../api/admin-bookings-api';

interface AdminBookingsState {
  data: PaginatedResponse<AdminBookingSummary> | null;
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export interface AdminBookingFilters {
  fromDate: string;
  query: string;
  status: BookingStatus | '';
  toDate: string;
}

export function useAdminBookings(filters: AdminBookingFilters, page: number) {
  const [state, setState] = useState<AdminBookingsState>({
    data: null,
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
  });

  const load = useCallback(
    async (refreshing = false) => {
      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && !current.data,
        isRefreshing: refreshing,
      }));

      try {
        const query: AdminBookingsQuery = {
          fromDate: filters.fromDate || undefined,
          limit: 20,
          page,
          status: filters.status || undefined,
          toDate: filters.toDate || undefined,
        };
        const response = await listAdminBookings(query);
        setState({
          data: response,
          errorMessage: null,
          isLoading: false,
          isRefreshing: false,
        });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Bookings could not be loaded. Please retry.',
          isLoading: false,
          isRefreshing: false,
        }));
      }
    },
    [filters.fromDate, filters.status, filters.toDate, page],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    ...state,
    filteredItems: filterBookings(state.data?.items ?? [], filters.query),
    refresh: () => load(true),
  };
}

function filterBookings(bookings: AdminBookingSummary[], query: string): AdminBookingSummary[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return bookings;
  }

  return bookings.filter((booking) =>
    [
      booking.bookingCode,
      booking.guestName,
      booking.guestPhone,
      booking.lodgeName,
      booking.roomNumber,
      booking.roomTypeName,
      booking.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized)),
  );
}
