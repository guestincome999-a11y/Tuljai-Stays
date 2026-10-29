import type { PilgrimRealtimeEvent } from '../realtime/realtime-events';

import type { PilgrimBooking } from './mock-data';

export function applyRealtimeBookingEvent(
  booking: PilgrimBooking,
  event: PilgrimRealtimeEvent,
): PilgrimBooking {
  const updatedAt = typeof event.payload.updatedAt === 'string' ? event.payload.updatedAt : null;
  const eventTime = updatedAt === null ? Number.NaN : Date.parse(updatedAt);
  // Receive time cannot order server writes. Unversioned events still trigger
  // the caller's reconciliation fetch, but do not overwrite a newer snapshot.
  if (
    updatedAt === null ||
    !Number.isFinite(eventTime) ||
    eventTime <= Date.parse(booking.updatedAt)
  )
    return booking;
  if (event.payload.status === 'ACCEPTED' || event.payload.status === 'QR_GENERATED')
    return { ...booking, qrReady: true, status: 'confirmed', updatedAt };
  if (
    event.payload.status === 'CANCELLED' ||
    event.payload.status === 'REJECTED' ||
    event.payload.status === 'EXPIRED'
  )
    return { ...booking, qrReady: false, status: 'cancelled', updatedAt };
  if (event.payload.status === 'CHECKED_IN')
    return { ...booking, qrReady: false, status: 'checked-in', updatedAt };
  if (event.payload.status === 'CHECKED_OUT' || event.payload.status === 'COMPLETED')
    return { ...booking, qrReady: false, status: 'completed', updatedAt };
  return booking;
}

export function mergeBackendBookingSnapshot(
  current: PilgrimBooking[],
  backend: PilgrimBooking[],
): PilgrimBooking[] {
  const currentById = new Map(current.map((booking) => [booking.id, booking]));
  return backend.map((booking) => {
    const existing = currentById.get(booking.id);
    if (!existing) return booking;
    const existingUpdatedAt = Date.parse(existing.updatedAt);
    const backendUpdatedAt = Date.parse(booking.updatedAt);
    return Number.isFinite(existingUpdatedAt) &&
      Number.isFinite(backendUpdatedAt) &&
      existingUpdatedAt > backendUpdatedAt
      ? existing
      : booking;
  });
}
