import type { Booking, BookingStatus, OwnerBookingSummary, PaginatedResponse } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface OwnerBookingsQuery {
  date?: string;
  limit?: number;
  lodgeId?: string;
  page?: number;
  status?: BookingStatus;
}

export async function listOwnerBookings(
  query: OwnerBookingsQuery,
): Promise<PaginatedResponse<OwnerBookingSummary>> {
  return apiClient.get<PaginatedResponse<OwnerBookingSummary>>('/owner/bookings', {
    params: query,
  });
}

export async function getOwnerBooking(bookingId: string): Promise<Booking> {
  return apiClient.get<Booking>(`/bookings/${bookingId}`);
}

export async function acceptOwnerBooking(bookingId: string): Promise<Booking> {
  return apiClient.post<Booking>(`/owner/bookings/${bookingId}/accept`);
}

export async function rejectOwnerBooking(bookingId: string, reason: string): Promise<Booking> {
  return apiClient.post<Booking>(`/owner/bookings/${bookingId}/reject`, { reason });
}
