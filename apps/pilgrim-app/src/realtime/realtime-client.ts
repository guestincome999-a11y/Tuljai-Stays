import { readPublicEnvironment } from '@tuljai/shared';
import { io, type Socket } from 'socket.io-client';

import { resolvePilgrimApiBaseUrl } from '../config/api-base-url';

import type { PilgrimRealtimeEventName } from './realtime-events';

type PilgrimServerEvents = Record<
  PilgrimRealtimeEventName,
  (payload: Record<string, unknown>) => void
> & {
  'system:error': (payload: { message?: string }) => void;
};

export type RealtimeSocket = Socket<PilgrimServerEvents, Record<string, never>>;

export function createRealtimeSocket(accessToken: string): RealtimeSocket {
  const environment = readPublicEnvironment({
    EXPO_PUBLIC_API_BASE_URL: resolvePilgrimApiBaseUrl(),
  });
  const serverUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

  return io(`${serverUrl}/realtime`, {
    auth: { token: accessToken },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    transports: ['websocket'],
  });
}
