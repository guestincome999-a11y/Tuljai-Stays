import type { SocketEventName } from '@tuljai/types';

export type PilgrimRealtimeEventName = Extract<
  SocketEventName,
  | 'announcement:new'
  | 'booking:accepted'
  | 'booking:expired'
  | 'booking:rejected'
  | 'checkin:completed'
  | 'checkout:completed'
  | 'notification:new'
  | 'notification:unread-count'
  | 'qr:generated'
>;

export interface PilgrimRealtimeEvent {
  name: PilgrimRealtimeEventName;
  payload: Record<string, unknown>;
  receivedAt: number;
}

export function getRealtimeMessage(event: PilgrimRealtimeEvent): string | null {
  if (event.name === 'booking:accepted') {
    return 'Your booking has been accepted!';
  }

  if (event.name === 'qr:generated') {
    return 'Your QR pass is ready.';
  }

  if (event.name === 'booking:rejected') {
    return 'Your booking was not accepted. You can browse other lodges.';
  }

  if (event.name === 'booking:expired') {
    return 'A booking request has expired.';
  }

  if (event.name === 'checkin:completed') {
    return 'Check-in completed.';
  }

  if (event.name === 'checkout:completed') {
    return 'Checkout completed.';
  }

  if (event.name === 'announcement:new') {
    return 'New announcement available.';
  }

  if (event.name === 'notification:new') {
    return 'New notification received.';
  }

  return null;
}

export function getEventBookingId(event: PilgrimRealtimeEvent | null): string | null {
  const bookingId = event?.payload.bookingId;

  return typeof bookingId === 'string' ? bookingId : null;
}
