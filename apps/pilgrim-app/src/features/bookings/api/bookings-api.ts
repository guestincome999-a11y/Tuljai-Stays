import type { AvailabilityResponse, Booking, BookingLock } from '@tuljai/types';

import { apiClient } from '../../../api/client';
import { getLodgeDetails, listLodgeRoomTypes } from '../../lodges/api/lodge-discovery-api';

export interface BookingLockRequest {
  checkInDate: string;
  checkOutDate: string;
  lodgeId: string;
  roomTypeId: string;
}

export interface CreateBookingRequest {
  alternatePhone?: string;
  guestAddress?: string;
  guestEmail?: string;
  guestName: string;
  guestPhone: string;
  lockCode: string;
  numberOfAdults: number;
  numberOfChildren: number;
  specialRequest?: string;
}

export interface EnrichedBooking {
  booking: Booking;
  lodgeName: string;
  roomTypeName: string;
}

export async function checkAvailability(input: BookingLockRequest): Promise<AvailabilityResponse> {
  return apiClient.get<AvailabilityResponse>(
    `/api/lodges/${input.lodgeId}/room-types/${input.roomTypeId}/availability`,
    {
      params: {
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
      },
    },
  );
}

export async function createBookingLock(input: BookingLockRequest): Promise<BookingLock> {
  return apiClient.post<BookingLock>('/api/bookings/lock', input);
}

export async function createBooking(input: CreateBookingRequest): Promise<Booking> {
  return apiClient.post<Booking>('/api/bookings', input);
}

export async function listMyBookings(): Promise<EnrichedBooking[]> {
  const bookings = await apiClient.get<Booking[]>('/api/bookings/my');

  return Promise.all(bookings.map((booking) => enrichBooking(booking)));
}

export async function getBooking(bookingId: string): Promise<EnrichedBooking> {
  const booking = await apiClient.get<Booking>(`/api/bookings/${bookingId}`);

  return enrichBooking(booking);
}

async function enrichBooking(booking: Booking): Promise<EnrichedBooking> {
  const [lodge, roomTypes] = await Promise.all([
    getLodgeDetails(booking.lodgeId).catch(() => null),
    listLodgeRoomTypes(booking.lodgeId).catch(() => []),
  ]);
  const roomType = roomTypes.find((item) => item.id === booking.roomTypeId);

  return {
    booking,
    lodgeName: lodge?.name ?? 'Tuljai Stays lodge',
    roomTypeName: roomType?.name ?? 'Selected room',
  };
}
