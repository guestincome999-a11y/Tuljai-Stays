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
  lastEvent: PilgrimRealtimeEvent | null;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  lastEvent: null,
});

const eventNames: PilgrimRealtimeEventName[] = [
  'announcement:new',
  'booking:accepted',
  'booking:expired',
  'booking:rejected',
  'checkin:completed',
  'checkout:completed',
  'notification:new',
  'notification:unread-count',
  'qr:generated',
];

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<PilgrimRealtimeEvent | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const accessToken = auth.session.tokens?.accessToken ?? null;

  useEffect(() => {
    if (!auth.isAuthenticated || !accessToken) {
      setConnected(false);
      return undefined;
    }

    const socket: RealtimeSocket = createRealtimeSocket(accessToken);

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    for (const eventName of eventNames) {
      socket.on(eventName, (payload) => {
        const event = {
          name: eventName,
          payload: isRecord(payload) ? payload : {},
          receivedAt: Date.now(),
        };
        setLastEvent(event);
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
  }, [accessToken, auth.isAuthenticated]);

  const value = useMemo(() => ({ connected, lastEvent }), [connected, lastEvent]);

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
