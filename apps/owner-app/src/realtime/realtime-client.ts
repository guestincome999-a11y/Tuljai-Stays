import { readPublicEnvironment } from '@tuljai/shared';
import { io, type Socket } from 'socket.io-client';

import type { OwnerRealtimeEventName, OwnerStatus } from './realtime-events';

interface OwnerClientEvents {
  'owner:status-update': (payload: { status: OwnerStatus }) => void;
  'presence:update': (payload: { status: OwnerStatus }) => void;
}

export type RealtimeSocket = Socket<
  Record<OwnerRealtimeEventName, (payload: Record<string, unknown>) => void>,
  OwnerClientEvents
>;

export function createRealtimeSocket(accessToken: string): RealtimeSocket {
  const environment = readPublicEnvironment(process.env);
  const serverUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

  return io(`${serverUrl}/realtime`, {
    auth: { token: accessToken },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    transports: ['websocket'],
  });
}
