import type { PilgrimBooking } from './mock-data';

function dateValue(value: string): number {
  const timestamp = new Date(`${value.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function isNotFinished(booking: PilgrimBooking, now: Date): boolean {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return dateValue(booking.checkOutDate) >= today;
}

function byNearestCheckIn(left: PilgrimBooking, right: PilgrimBooking): number {
  return dateValue(left.checkInDate) - dateValue(right.checkInDate);
}

export function isActionablePassBooking(booking: PilgrimBooking, now = new Date()): boolean {
  if (!isNotFinished(booking, now)) return false;

  return (
    (booking.status === 'confirmed' && booking.qrReady === true) || booking.status === 'pending'
  );
}

/** Selects exactly one stay for the dedicated Pass screen. */
export function selectCurrentPassBooking(
  bookings: PilgrimBooking[],
  now = new Date(),
): PilgrimBooking | undefined {
  const confirmed = bookings
    .filter(
      (booking) =>
        booking.status === 'confirmed' && booking.qrReady === true && isNotFinished(booking, now),
    )
    .sort(byNearestCheckIn);

  if (confirmed[0]) return confirmed[0];

  const pending = bookings
    .filter((booking) => booking.status === 'pending' && isNotFinished(booking, now))
    .sort(byNearestCheckIn);

  if (pending[0]) return pending[0];

  return bookings
    .filter((booking) => booking.status === 'checked-in' && isNotFinished(booking, now))
    .sort(byNearestCheckIn)[0];
}
