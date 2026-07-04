import type { SocketEventName } from '@tuljai/types';

export type OwnerRealtimeEventName = Extract<
  SocketEventName,
  | 'announcement:new'
  | 'booking:accepted'
  | 'booking:expired'
  | 'booking:new'
  | 'booking:rejected'
  | 'dashboard:update'
  | 'notification:new'
  | 'notification:unread-count'
  | 'owner:alert'
  | 'room:availability-updated'
>;

export type OwnerStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export interface OwnerRealtimeEvent {
  name: OwnerRealtimeEventName;
  payload: Record<string, unknown>;
  receivedAt: number;
}

export function getRealtimeMessage(event: OwnerRealtimeEvent): string | null {
  if (event.name === 'booking:new' || event.name === 'owner:alert') {
    return 'New booking request received.';
  }

  if (event.name === 'booking:accepted') {
    return 'Booking accepted.';
  }

  if (event.name === 'booking:rejected') {
    return 'Booking rejected.';
  }

  if (event.name === 'booking:expired') {
    return 'A booking request expired.';
  }

  if (event.name === 'notification:new') {
    return 'New notification received.';
  }

  if (event.name === 'announcement:new') {
    return 'New announcement available.';
  }

  return null;
}

export function getEventBookingId(event: OwnerRealtimeEvent | null): string | null {
  const bookingId = event?.payload.bookingId;

  return typeof bookingId === 'string' ? bookingId : null;
}
