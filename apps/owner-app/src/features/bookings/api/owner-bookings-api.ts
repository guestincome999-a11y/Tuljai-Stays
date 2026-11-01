import type {
  AvailabilityResponse,
  Booking,
  BookingStatus,
  OwnerBookingSummary,
  PaginatedResponse,
} from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface OwnerBookingsQuery {
  checkInFrom?: string;
  checkInTo?: string;
  checkOutFrom?: string;
  checkOutTo?: string;
  date?: string;
  limit?: number;
  lodgeId?: string;
  order?: 'asc' | 'desc';
  page?: number;
  payment?: 'PAY_AT_LODGE' | 'PREPAID';
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
  return respondOnce(bookingId, () =>
    apiClient.post<Booking>(`/owner/bookings/${bookingId}/accept`),
  );
}

export async function rejectOwnerBooking(bookingId: string, reason: string): Promise<Booking> {
  return respondOnce(bookingId, () =>
    apiClient.post<Booking>(`/owner/bookings/${bookingId}/reject`, { reason }),
  );
}

/** Same authoritative inventory endpoint used by the booking workflow. */
export async function getRoomTypeAvailability(
  lodgeId: string,
  roomTypeId: string,
  checkInDate: string,
  checkOutDate: string,
): Promise<AvailabilityResponse> {
  return apiClient.get<AvailabilityResponse>(
    `/lodges/${lodgeId}/room-types/${roomTypeId}/availability`,
    {
      params: { checkInDate, checkOutDate },
    },
  );
}

// Shared by push actions, details, notifications and the fullscreen alert.
const pendingResponses = new Set<string>();
async function respondOnce(bookingId: string, respond: () => Promise<Booking>): Promise<Booking> {
  if (pendingResponses.has(bookingId))
    throw new Error('A response to this booking is already in progress.');
  pendingResponses.add(bookingId);
  try {
    return await respond();
  } finally {
    pendingResponses.delete(bookingId);
  }
}
