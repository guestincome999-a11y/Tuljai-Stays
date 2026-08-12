import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Snackbar } from 'react-native-paper';

import { useAuth } from '../auth/auth-context';

import { createRealtimeSocket, type RealtimeSocket } from './realtime-client';
import {
  getRealtimeMessage,
  type PilgrimRealtimeEvent,
  type PilgrimRealtimeEventName,
} from './realtime-events';

interface RealtimeContextValue {
  connected: boolean;
  connectionRevision: number;
  lastBookingEvent: PilgrimRealtimeEvent | null;
  lastEvent: PilgrimRealtimeEvent | null;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  connectionRevision: 0,
  lastBookingEvent: null,
  lastEvent: null,
});

const eventNames: PilgrimRealtimeEventName[] = [
  'announcement:new',
  'booking:accepted',
  'booking:cancelled',
  'booking:expired',
  'booking:rejected',
  'checkin:completed',
  'checkout:completed',
  'lodge:catalog-updated',
  'notification:new',
  'notification:unread-count',
  'qr:generated',
];

const bookingEventNames = new Set<PilgrimRealtimeEventName>([
  'booking:accepted',
  'booking:cancelled',
  'booking:expired',
  'booking:rejected',
  'checkin:completed',
  'checkout:completed',
  'qr:generated',
]);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [connected, setConnected] = useState(false);
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [lastBookingEvent, setLastBookingEvent] = useState<PilgrimRealtimeEvent | null>(null);
  const [lastEvent, setLastEvent] = useState<PilgrimRealtimeEvent | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const accessToken = auth.session.tokens?.accessToken ?? null;

  useEffect(() => {
    if (!auth.isAuthenticated || !accessToken) {
      setConnected(false);
      return undefined;
    }

    let socket: RealtimeSocket;

    try {
      socket = createRealtimeSocket(accessToken);
    } catch {
      setConnected(false);
      return undefined;
    }

    socket.on('connect', () => setConnected(false));
    socket.on('connection:ready', (payload) => {
      setConnected(payload.authenticated);
      if (payload.authenticated) {
        setConnectionRevision((current) => current + 1);
      }
    });
    socket.on('connect_error', () => setConnected(false));
    socket.on('disconnect', () => setConnected(false));
    socket.on('system:error', () => {
      setConnected(false);
      void auth.refreshSession();
    });

    for (const eventName of eventNames) {
      socket.on(eventName, (payload) => {
        const event = {
          name: eventName,
          payload: isRecord(payload) ? payload : {},
          receivedAt: Date.now(),
        };
        setLastEvent(event);
        if (bookingEventNames.has(eventName)) {
          setLastBookingEvent(event);
        }
        const message = getRealtimeMessage(event);

        if (message) {
          setSnackbarMessage(message);
        }
      });
    }

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [accessToken, auth.isAuthenticated, auth.refreshSession]);

  const value = useMemo(
    () => ({ connected, connectionRevision, lastBookingEvent, lastEvent }),
    [connected, connectionRevision, lastBookingEvent, lastEvent],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      <Snackbar onDismiss={() => setSnackbarMessage(null)} visible={Boolean(snackbarMessage)}>
        {snackbarMessage}
      </Snackbar>
    </RealtimeContext.Provider>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
