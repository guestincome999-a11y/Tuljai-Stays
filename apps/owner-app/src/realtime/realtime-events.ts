import type { SocketEventName } from '@tuljai/types';

export type OwnerRealtimeEventName = Extract<
  SocketEventName,
  | 'announcement:new'
  | 'booking:accepted'
  | 'booking:cancelled'
  | 'booking:expired'
  | 'booking:new'
  | 'booking:rejected'
  | 'booking:updated'
  | 'checkin:completed'
  | 'checkout:completed'
  | 'dashboard:update'
  | 'lodge:catalog-updated'
  | 'notification:new'
  | 'notification:unread-count'
  | 'owner:alert'
  | 'qr:scan-failed'
  | 'qr:scan-success'
  | 'room:availability-updated'
  | 'room:status-updated'
>;

export type OwnerStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export interface OwnerRealtimeEvent {
  name: OwnerRealtimeEventName;
  payload: Record<string, unknown>;
  receivedAt: number;
}

export function getRealtimeMessage(event: OwnerRealtimeEvent): string | null {
  if (event.name === 'booking:new' || event.name === 'owner:alert')
    return 'New booking request received.';
  if (event.name === 'booking:accepted') return 'Booking accepted.';
  if (event.name === 'booking:updated') return 'A booking was updated by Tuljai Stays support.';
  if (event.name === 'booking:cancelled') return 'A pilgrim cancelled a booking.';
  if (event.name === 'booking:rejected') return 'Booking rejected.';
  if (event.name === 'booking:expired') return 'A booking request expired.';
  if (event.name === 'notification:new') return 'New notification received.';
  if (event.name === 'checkin:completed' || event.name === 'qr:scan-success')
    return 'Guest check-in completed.';
  if (event.name === 'checkout:completed') return 'Guest checkout completed.';
  if (event.name === 'announcement:new') return 'New announcement available.';
  return null;
}

export function getEventBookingId(event: OwnerRealtimeEvent | null): string | null {
  const bookingId = event?.payload.bookingId;
  return typeof bookingId === 'string' ? bookingId : null;
}
