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
  connectionRevision: number;
  lastBookingRequest: OwnerRealtimeEvent | null;
  lastEvent: OwnerRealtimeEvent | null;
  ownerStatus: OwnerStatus;
  setOwnerStatus(status: OwnerStatus): void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  connectionRevision: 0,
  lastBookingRequest: null,
  lastEvent: null,
  ownerStatus: 'AVAILABLE',
  setOwnerStatus: () => undefined,
});

const eventNames: OwnerRealtimeEventName[] = [
  'announcement:new',
  'booking:accepted',
  'booking:cancelled',
  'booking:expired',
  'booking:new',
  'booking:rejected',
  'checkin:completed',
  'checkout:completed',
  'dashboard:update',
  'lodge:catalog-updated',
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
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [lastBookingRequest, setLastBookingRequest] = useState<OwnerRealtimeEvent | null>(null);
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

    let nextSocket: RealtimeSocket;

    try {
      nextSocket = createRealtimeSocket(accessToken);
    } catch {
      setConnected(false);
      setSocket(null);
      return undefined;
    }

    setSocket(nextSocket);

    nextSocket.on('connect', () => setConnected(false));
    nextSocket.on('connection:ready', (payload) => {
      setConnected(payload.authenticated);
      if (payload.authenticated) {
        setConnectionRevision((current) => current + 1);
      }
    });
    nextSocket.on('connect_error', () => setConnected(false));
    nextSocket.on('disconnect', () => setConnected(false));
    nextSocket.on('system:error', () => {
      setConnected(false);
      void auth.refreshSession();
    });

    for (const eventName of eventNames) {
      nextSocket.on(eventName, (payload) => {
        const event = {
          name: eventName,
          payload: isRecord(payload) ? payload : {},
          receivedAt: Date.now(),
        };
        setLastEvent(event);
        if (isBookingRequestEvent(event)) {
          setLastBookingRequest(event);
        }
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
  }, [accessToken, auth.isAuthenticated, auth.refreshSession]);

  const setOwnerStatus = useCallback(
    (status: OwnerStatus) => {
      setOwnerStatusState(status);
      socket?.emit('owner:status-update', { status });
      socket?.emit('presence:update', { status });
    },
    [socket],
  );

  const value = useMemo(
    () => ({
      connected,
      connectionRevision,
      lastBookingRequest,
      lastEvent,
      ownerStatus,
      setOwnerStatus,
    }),
    [connected, connectionRevision, lastBookingRequest, lastEvent, ownerStatus, setOwnerStatus],
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

function isBookingRequestEvent(event: OwnerRealtimeEvent): boolean {
  if (event.name === 'booking:new' || event.name === 'owner:alert') {
    return true;
  }

  if (event.name !== 'notification:new') {
    return false;
  }

  const notification = event.payload.notification;

  return isRecord(notification) && notification.type === 'BOOKING_REQUEST';
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
