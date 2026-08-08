import type {
  AvailabilityResponse,
  Booking,
  BookingGuestIdProofUpload,
  BookingLock,
} from '@tuljai/types';

import { apiClient } from '../../../api/client';
import {
  getLodgeDetails,
  listLodgePhotos,
  listLodgeRoomTypes,
} from '../../lodges/api/lodge-discovery-api';

export interface BookingLockRequest {
  checkInDate: string;
  checkOutDate: string;
  lodgeId: string;
  roomTypeId: string;
}

export interface CreateBookingRequest {
  alternatePhone?: string;
  checkoutDateFlexible: boolean;
  guestAddress?: string;
  guestEmail?: string;
  guestName: string;
  guestPhone: string;
  guestIdProofMimeType: string;
  guestIdProofOriginalName: string;
  guestIdProofSizeBytes: number;
  guestIdProofStoragePath: string;
  lockCode: string;
  numberOfAdults: number;
  numberOfChildren: number;
  specialRequest?: string;
}

export interface GuestIdProofFile {
  mimeType: string;
  name: string;
  sizeBytes?: number;
  uri: string;
  webFile?: File;
}

export interface EnrichedBooking {
  booking: Booking;
  coverPhotoUrl: string | null;
  directionsQuery: string | null;
  lodgeName: string;
  roomTypeName: string;
}

export async function checkAvailability(input: BookingLockRequest): Promise<AvailabilityResponse> {
  return apiClient.get<AvailabilityResponse>(
    `/lodges/${input.lodgeId}/room-types/${input.roomTypeId}/availability`,
    {
      params: {
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
      },
    },
  );
}

export async function createBookingLock(input: BookingLockRequest): Promise<BookingLock> {
  return apiClient.post<BookingLock>('/bookings/lock', input);
}

export async function createBooking(input: CreateBookingRequest): Promise<Booking> {
  return apiClient.post<Booking>('/bookings', input);
}

export async function uploadGuestIdProof(
  proof: GuestIdProofFile,
): Promise<BookingGuestIdProofUpload> {
  const formData = new FormData();

  if (proof.webFile) {
    formData.append('file', proof.webFile, proof.name);
  } else {
    formData.append('file', {
      name: proof.name,
      type: proof.mimeType,
      uri: proof.uri,
    } as unknown as Blob);
  }

  return apiClient.post<BookingGuestIdProofUpload>('/bookings/guest-id-proof', formData);
}

export async function listMyBookings(): Promise<EnrichedBooking[]> {
  const bookings = await apiClient.get<Booking[]>('/bookings/my');

  return Promise.all(bookings.map((booking) => enrichBooking(booking)));
}

export async function getBooking(bookingId: string): Promise<EnrichedBooking> {
  const booking = await getBookingRecord(bookingId);

  return enrichBooking(booking);
}

export async function getBookingRecord(bookingId: string): Promise<Booking> {
  return apiClient.get<Booking>(`/bookings/${bookingId}`);
}

export async function cancelBooking(bookingId: string, reason?: string): Promise<Booking> {
  return apiClient.post<Booking>(`/bookings/${bookingId}/cancel`, { reason });
}

async function enrichBooking(booking: Booking): Promise<EnrichedBooking> {
  const [lodge, photos, roomTypes] = await Promise.all([
    getLodgeDetails(booking.lodgeId).catch(() => null),
    listLodgePhotos(booking.lodgeId).catch(() => []),
    listLodgeRoomTypes(booking.lodgeId).catch(() => []),
  ]);
  const roomType = roomTypes.find((item) => item.id === booking.roomTypeId);
  const coverPhoto = photos.find((photo) => photo.isCover) ?? photos[0] ?? null;

  return {
    booking,
    coverPhotoUrl: coverPhoto?.thumbnailUrl ?? coverPhoto?.fileUrl ?? null,
    directionsQuery: lodge?.address
      ? [
          lodge.address.addressLine1,
          lodge.address.addressLine2,
          lodge.address.landmark,
          lodge.address.city,
          lodge.address.pincode,
        ]
          .filter(Boolean)
          .join(', ')
      : (lodge?.name ?? null),
    lodgeName: lodge?.name ?? 'Tuljai Stays lodge',
    roomTypeName: roomType?.name ?? 'Selected room',
  };
}
