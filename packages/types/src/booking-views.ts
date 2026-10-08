import type { BookingStatus } from './booking';
import type { UUID } from './common';

export type AdminBookingViewKey = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type AdminBookingDateRange = 'all' | 'today' | 'tomorrow' | 'week' | 'later' | 'custom';

export interface AdminBookingViewRow {
  bookingCode: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  id: UUID;
  lodgeName: string;
  paymentStatus: string;
  roomTypeName: string;
  status: BookingStatus;
  totalAmount: string | null;
}

export interface AdminBookingViewPage {
  items: AdminBookingViewRow[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type AdminBookingConflictKind = 'DOUBLE_BOOKED_ROOM' | 'OVERBOOKED_ROOM_TYPE';

export interface AdminBookingConflictBooking {
  bookingCode: string;
  bookingId: UUID;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  status: BookingStatus;
}

export interface AdminBookingConflict {
  bookings: AdminBookingConflictBooking[];
  detail: string;
  id: string;
  kind: AdminBookingConflictKind;
  lodgeName: string;
  /** First date (YYYY-MM-DD) on which the conflict occurs. */
  onDate: string;
}
