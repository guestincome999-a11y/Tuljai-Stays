import type {
  AvailabilityResponse,
  Booking,
  BookingStatus,
  OwnerBookingSummary,
  PaginatedResponse,
} from '@tuljai/types';

import { apiClient } from '../../../api/client';

const bookingScanCache = new Map<string, OwnerBookingSummary>();
let cacheRevision = 0;
export function clearBookingScanCache() {
  cacheRevision++;
  bookingScanCache.clear();
}
export function getCachedScanBooking(bookingId: string) {
  return bookingScanCache.get(bookingId);
}

export interface OwnerBookingsQuery {
  search?: string;
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

export function lookupOwnerBookingQr(
  qrPayload: string,
  lodgeId: string,
): Promise<{ bookingCode: string }> {
  return apiClient.post('/owner/bookings/lookup-qr', { qrPayload, lodgeId });
}

export async function listOwnerBookings(
  query: OwnerBookingsQuery,
): Promise<PaginatedResponse<OwnerBookingSummary>> {
  const revision = cacheRevision;
  const response = await apiClient.get<PaginatedResponse<OwnerBookingSummary>>('/owner/bookings', {
    params: query,
  });
  if (revision === cacheRevision)
    response.items.forEach((booking) => bookingScanCache.set(booking.id, booking));
  return response;
}

export async function getOwnerBooking(bookingId: string): Promise<OwnerBookingSummary> {
  const revision = cacheRevision;
  const booking = await apiClient.get<OwnerBookingSummary>(`/owner/bookings/${bookingId}`);
  if (revision === cacheRevision) bookingScanCache.set(booking.id, booking);
  return booking;
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
