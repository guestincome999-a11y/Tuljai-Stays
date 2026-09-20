import type { Booking, BookingStatus, OwnerBookingSummary, PaginatedResponse } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface OwnerBookingsQuery {
  checkInFrom?: string;
  checkInTo?: string;
  date?: string;
  limit?: number;
  lodgeId?: string;
  order?: 'asc' | 'desc';
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

export async function getOwnerBooking(bookingId: string): Promise<OwnerBookingSummary> {
  return apiClient.get<OwnerBookingSummary>(`/owner/bookings/${bookingId}`);
}

export async function acceptOwnerBooking(bookingId: string): Promise<Booking> {
  return apiClient.post<Booking>(`/owner/bookings/${bookingId}/accept`);
}

export async function rejectOwnerBooking(bookingId: string, reason: string): Promise<Booking> {
  return apiClient.post<Booking>(`/owner/bookings/${bookingId}/reject`, { reason });
}
