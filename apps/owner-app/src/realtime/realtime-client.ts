import { readPublicEnvironment } from '@tuljai/shared';
import { io, type Socket } from 'socket.io-client';

import { resolveOwnerApiBaseUrl } from '../config/api-base-url';

import type { OwnerRealtimeEventName, OwnerStatus } from './realtime-events';

interface OwnerClientEvents {
  'lodge:join': (payload: { lodgeId: string }) => void;
  'owner:status-update': (payload: { status: OwnerStatus }) => void;
  'presence:update': (payload: { status: OwnerStatus }) => void;
}

type OwnerServerEvents = Record<
  OwnerRealtimeEventName,
  (payload: Record<string, unknown>) => void
> & {
  'connection:ready': (payload: {
    authenticated: boolean;
    connected: boolean;
    lodgeIds?: string[];
  }) => void;
  'lodge:joined': (payload: { lodgeId: string }) => void;
  'system:error': (payload: { message?: string }) => void;
};

export type RealtimeSocket = Socket<
  OwnerServerEvents,
  OwnerClientEvents
>;

export function createRealtimeSocket(accessToken: string): RealtimeSocket {
  const environment = readPublicEnvironment({
    EXPO_PUBLIC_API_BASE_URL: resolveOwnerApiBaseUrl(),
  });
  const serverUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

  return io(`${serverUrl}/realtime`, {
    auth: { token: accessToken },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
  });
}
