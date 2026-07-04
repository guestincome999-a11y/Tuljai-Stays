import { readPublicEnvironment } from '@tuljai/shared';
import { io, type Socket } from 'socket.io-client';

import type { PilgrimRealtimeEventName } from './realtime-events';

export type RealtimeSocket = Socket<
  Record<string, never>,
  Record<PilgrimRealtimeEventName, (payload: Record<string, unknown>) => void>
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
