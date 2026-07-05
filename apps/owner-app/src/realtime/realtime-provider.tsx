import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Snackbar } from 'react-native-paper';

import { useAuth } from '../auth/auth-context';

import { createRealtimeSocket, type RealtimeSocket } from './realtime-client';
import {
  getRealtimeMessage,
  type OwnerRealtimeEvent,
  type OwnerRealtimeEventName,
  type OwnerStatus,
} from './realtime-events';

interface RealtimeContextValue {
  connected: boolean;
  lastEvent: OwnerRealtimeEvent | null;
  ownerStatus: OwnerStatus;
  setOwnerStatus(status: OwnerStatus): void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  lastEvent: null,
  ownerStatus: 'AVAILABLE',
  setOwnerStatus: () => undefined,
});

const eventNames: OwnerRealtimeEventName[] = [
  'announcement:new',
  'booking:accepted',
  'booking:expired',
  'booking:new',
  'booking:rejected',
  'checkin:completed',
  'checkout:completed',
  'dashboard:update',
  'notification:new',
  'notification:unread-count',
  'owner:alert',
  'qr:scan-failed',
  'qr:scan-success',
  'room:availability-updated',
  'room:status-updated',
];

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<OwnerRealtimeEvent | null>(null);
  const [ownerStatus, setOwnerStatusState] = useState<OwnerStatus>('AVAILABLE');
  const [socket, setSocket] = useState<RealtimeSocket | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const accessToken = auth.session.tokens?.accessToken ?? null;

  useEffect(() => {
    if (!auth.isAuthenticated || !accessToken) {
      setConnected(false);
      setSocket(null);
      return undefined;
    }

    const nextSocket: RealtimeSocket = createRealtimeSocket(accessToken);
    setSocket(nextSocket);

    nextSocket.on('connect', () => setConnected(true));
    nextSocket.on('disconnect', () => setConnected(false));

    for (const eventName of eventNames) {
      nextSocket.on(eventName, (payload) => {
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
      nextSocket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [accessToken, auth.isAuthenticated]);

  const setOwnerStatus = useCallback(
    (status: OwnerStatus) => {
      setOwnerStatusState(status);
      socket?.emit('owner:status-update', { status });
      socket?.emit('presence:update', { status });
    },
    [socket],
  );

  const value = useMemo(
    () => ({ connected, lastEvent, ownerStatus, setOwnerStatus }),
    [connected, lastEvent, ownerStatus, setOwnerStatus],
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
