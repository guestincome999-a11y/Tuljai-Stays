import type { AdminBookingSummary, Booking, BookingStatus, PaginatedResponse } from '@tuljai/types';

import { apiClient } from './client';

export interface AdminBookingsQuery {
  cityId?: string;
  fromDate?: string;
  limit?: number;
  lodgeId?: string;
  page?: number;
  status?: BookingStatus;
  toDate?: string;
}

export async function listAdminBookings(
  query: AdminBookingsQuery = {},
): Promise<PaginatedResponse<AdminBookingSummary>> {
  return apiClient.get<PaginatedResponse<AdminBookingSummary>>('/admin/bookings', {
    params: {
      limit: query.limit ?? 20,
      page: query.page ?? 1,
      ...query,
    },
  });
}

export async function getAdminBooking(bookingId: string): Promise<Booking> {
  return apiClient.get<Booking>(`/bookings/${bookingId}`);
}

export async function updateAdminBookingStatus(
  bookingId: string,
  input: { notes: string; status: BookingStatus },
): Promise<Booking> {
  return apiClient.request<Booking>(`/admin/bookings/${bookingId}/status`, {
    body: input,
    method: 'PATCH',
  });
}
