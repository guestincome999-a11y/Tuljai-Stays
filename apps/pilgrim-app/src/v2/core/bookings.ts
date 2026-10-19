import type { Booking, BookingLodgeContact, QrDisplayPayload } from '@tuljai/types';

import { api } from './api';

export interface MyBookingCard {
  bookingCode: string;
  checkInDate: string;
  checkOutDate: string;
  coverUrl: string | null;
  createdAt: string;
  id: string;
  lodgeId: string;
  lodgeName: string;
  paymentStatus: string;
  roomTypeName: string;
  status: string;
  totalAmount: string | null;
  totalGuests: number;
}

/** One request returns every booking with lodge name, room name and cover photo already joined. */
export function fetchMyBookings(): Promise<MyBookingCard[]> {
  return api.get<MyBookingCard[]>('/catalog/my-bookings');
}

export function fetchBooking(bookingId: string): Promise<Booking> {
  return api.get<Booking>(`/bookings/${bookingId}`);
}

export function fetchQrPass(bookingId: string): Promise<QrDisplayPayload> {
  return api.get<QrDisplayPayload>(`/bookings/${bookingId}/qr`);
}

export function fetchLodgeContact(bookingId: string): Promise<BookingLodgeContact> {
  return api.get<BookingLodgeContact>(`/bookings/${bookingId}/lodge-contact`);
}

export function cancelBooking(bookingId: string, reason?: string): Promise<Booking> {
  return api.post<Booking>(`/bookings/${bookingId}/cancel`, { reason });
}
