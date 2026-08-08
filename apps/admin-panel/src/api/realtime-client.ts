import { io, type Socket } from 'socket.io-client';

import { resolveAdminApiBaseUrl } from '../config/api-base-url';

const realtimeEvents = [
  'announcement:new',
  'booking:accepted',
  'booking:cancelled',
  'booking:expired',
  'booking:new',
  'booking:rejected',
  'checkin:completed',
  'checkout:completed',
  'dashboard:update',
  'notification:new',
  'owner:status',
  'owner:status-update',
  'qr:generated',
  'qr:scan-failed',
  'qr:scan-success',
  'qr:scanned',
  'room:status',
  'room:status-updated',
] as const;

export type AdminRealtimeEventName = (typeof realtimeEvents)[number];

export interface AdminRealtimeEvent {
  name: AdminRealtimeEventName;
  payload: Record<string, unknown>;
  receivedAt: number;
}

type AdminServerEvents = Record<
  AdminRealtimeEventName,
  (payload: Record<string, unknown>) => void
> & {
  'system:error': (payload: { message?: string }) => void;
};

export type AdminRealtimeSocket = Socket<AdminServerEvents, Record<string, never>>;

export function createAdminRealtimeSocket(accessToken: string): AdminRealtimeSocket {
  const apiBaseUrl = resolveAdminApiBaseUrl();
  const serverUrl = apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

  return io(`${serverUrl}/realtime`, {
    auth: { token: accessToken },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    transports: ['websocket'],
  });
}

export function subscribeAdminRealtimeSessionRecovery(
  socket: AdminRealtimeSocket,
  refreshSession: () => Promise<string | null>,
): void {
  socket.on('system:error', (payload) => {
    if (/(?:auth|session|token)/iu.test(payload.message ?? '')) {
      void refreshSession();
    }
  });
}

export function subscribeAdminRealtimeEvents(
  socket: AdminRealtimeSocket,
  onEvent: (event: AdminRealtimeEvent) => void,
): void {
  for (const eventName of realtimeEvents) {
    socket.on(eventName, (payload) => {
      onEvent({
        name: eventName,
        payload: isRecord(payload) ? payload : {},
        receivedAt: Date.now(),
      });
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
