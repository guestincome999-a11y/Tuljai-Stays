import type {
  AvailabilityResponse,
  Booking,
  BookingGuestIdProofUpload,
  BookingLock,
} from '@tuljai/types';

import type {
  CreateBookingRequest,
  PaymentRecoveryStatus,
} from '../../features/bookings/api/bookings-api';
import { newCheckoutAttemptKey } from '../../features/bookings/checkout-attempt';

import { api } from './api';

export interface StayRequest {
  checkInDate: string;
  checkOutDate: string;
  lodgeId: string;
  roomTypeId: string;
}

export interface GuestBookingDetails {
  guestEmail?: string;
  guestIdProof: BookingGuestIdProofUpload;
  guestName: string;
  /** E.164, for example +919876543210. */
  guestPhone: string;
  numberOfAdults: number;
  numberOfChildren: number;
  specialRequest?: string;
}

export interface PrepaidOrder {
  amount: number;
  currency: string;
  keyId: string;
  lockCode: string;
  orderId: string;
}

export interface IdProofFile {
  mimeType: string;
  name: string;
  sizeBytes?: number;
  uri: string;
}

/** A 409 from the backend means the last room was taken while the guest was deciding. */
export function isRoomFullError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('details' in error)) return false;
  const { details } = error as { details?: { statusCode?: number } };
  return details?.statusCode === 409;
}

export function fetchAvailability(stay: StayRequest): Promise<AvailabilityResponse> {
  return api.get<AvailabilityResponse>(
    `/lodges/${stay.lodgeId}/room-types/${stay.roomTypeId}/availability`,
    { params: { checkInDate: stay.checkInDate, checkOutDate: stay.checkOutDate } },
  );
}

/** Holds a room and creates its Razorpay order in one call, so payment can open instantly later. */
export function holdPrepaidRoom(
  stay: StayRequest,
  idempotencyKey = newCheckoutAttemptKey(),
): Promise<PrepaidOrder> {
  return api.request<PrepaidOrder>('/payments/prepaid/hold', {
    method: 'POST',
    body: stay,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

/** Best-effort. If it fails the hold simply expires on its own. */
export async function releasePrepaidHold(lockCode: string): Promise<void> {
  await api.post('/payments/prepaid/release', { lockCode });
}

function bookingFields(details: GuestBookingDetails) {
  return {
    checkoutDateFlexible: false,
    guestEmail: details.guestEmail,
    guestIdProofMimeType: details.guestIdProof.mimeType,
    guestIdProofOriginalName: details.guestIdProof.originalName,
    guestIdProofSizeBytes: details.guestIdProof.sizeBytes,
    guestIdProofStoragePath: details.guestIdProof.storagePath,
    guestName: details.guestName,
    guestPhone: details.guestPhone,
    numberOfAdults: details.numberOfAdults,
    numberOfChildren: details.numberOfChildren,
    specialRequest: details.specialRequest,
  };
}

/** Creates the booking only after the backend has verified the Razorpay payment. */
export function confirmPrepaidBooking(
  lockCode: string,
  details: GuestBookingDetails,
  payment: { orderId: string; paymentId: string; signature: string },
): Promise<Booking> {
  return api.post<Booking>('/payments/prepaid/confirm', {
    ...bookingFields(details),
    ...payment,
    lockCode,
    paymentMethod: 'ONLINE',
  });
}

/** Pay-at-lodge booking: lock the room, then create a request the owner approves. */
export async function bookPayAtLodge(
  stay: StayRequest,
  details: GuestBookingDetails,
): Promise<Booking> {
  const lock = await api.post<BookingLock>('/bookings/lock', stay);
  return api.post<Booking>('/bookings', {
    ...bookingFields(details),
    lockCode: lock.lockCode,
    paymentMethod: 'PAY_AT_LODGE',
  });
}

export function uploadIdProof(file: IdProofFile): Promise<BookingGuestIdProofUpload> {
  const form = new FormData();
  form.append('file', { name: file.name, type: file.mimeType, uri: file.uri } as unknown as Blob);
  return api.post<BookingGuestIdProofUpload>('/bookings/guest-id-proof', form);
}

export async function preparePrepaidIntent(
  lockCode: string,
  details: GuestBookingDetails,
): Promise<void> {
  await api.post('/payments/prepaid/prepare', {
    ...bookingFields(details),
    lockCode,
    paymentMethod: 'ONLINE',
  });
}

export function getPrepaidPaymentStatus(orderId: string): Promise<PaymentRecoveryStatus> {
  return api.get(`/payments/orders/${encodeURIComponent(orderId)}/status`);
}

export function confirmRecoveredPayment(
  input: CreateBookingRequest & {
    orderId: string;
    paymentId: string;
    signature: string;
  },
): Promise<Booking> {
  return api.post('/payments/prepaid/confirm', { ...input, paymentMethod: 'ONLINE' });
}
