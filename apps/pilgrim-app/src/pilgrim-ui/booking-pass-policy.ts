import type { QrDisplayPayload } from '@tuljai/types';

import type { PilgrimBooking } from './mock-data';

// The existing owner policy consumes check-in tokens once; checked-in stays
// retain their history but cannot present a second check-in credential.
export function canViewBookingQr(booking: PilgrimBooking, now = Date.now()): boolean {
  return (
    booking.status === 'confirmed' &&
    booking.qrReady === true &&
    !['Payment pending', 'Payment failed', 'Refunded'].includes(booking.paymentStatus) &&
    Date.parse(`${booking.checkOutDate.slice(0, 10)}T23:59:59+05:30`) >= now
  );
}

export function isCurrentBookingQr(
  payload: QrDisplayPayload | null,
  booking: PilgrimBooking | undefined,
  now = Date.now(),
): payload is QrDisplayPayload {
  return Boolean(
    payload &&
    booking &&
    canViewBookingQr(booking, now) &&
    payload.bookingId === booking.id &&
    payload.bookingCode === booking.bookingCode &&
    payload.status === 'ACTIVE' &&
    payload.qrPayload &&
    Date.parse(payload.expiresAt) > now,
  );
}
