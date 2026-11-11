import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

import { notifyAvailabilityChange } from '../../features/bookings/availability-sync';
import { requestPaymentReconciliation } from '../../features/bookings/payment-outcome';
import { notificationState } from '../../features/notifications/notification-count-store';
import { extraStrings, realtimeMessages } from '../i18n/extraStrings';
import { useLang } from '../i18n/language';
import { useToast } from '../ui/Toast';

import { apiBaseUrl, refreshAccessToken } from './api';
import { refreshAllCached } from './useCachedFetch';
import { useSession } from './useSession';

const REFRESH_DEBOUNCE_MS = 400;

const EVENT_NAMES = [
  'announcement:new',
  'booking:accepted',
  'booking:cancelled',
  'booking:expired',
  'booking:rejected',
  'booking:updated',
  'checkin:completed',
  'checkout:completed',
  'lodge:catalog-updated',
  'notification:new',
  'notification:unread-count',
  'qr:generated',
  'room:availability-updated',
] as const;

/**
 * Keeps the app live: when a lodge owner changes a price or accepts a booking, the backend pushes
 * an event and everything on screen refreshes within a moment, with no pull-to-refresh needed.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const { t } = useLang();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const translate = useRef(t);
  translate.current = t;
  const accessToken = session.tokens?.accessToken ?? null;

  useEffect(() => {
    if (!accessToken) return undefined;
    let socket: Socket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let connected = false;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refreshAllCached(), REFRESH_DEBOUNCE_MS);
    };

    try {
      const serverUrl = apiBaseUrl()
        .replace(/\/api\/?$/u, '')
        .replace(/\/$/u, '');
      socket = io(`${serverUrl}/realtime`, {
        auth: { token: accessToken },
        reconnection: true,
        reconnectionAttempts: Infinity,
        transports: ['websocket', 'polling'],
      });
    } catch {
      return undefined;
    }

    socket.on('connection:ready', (payload: { authenticated?: boolean }) => {
      connected = Boolean(payload.authenticated);
      if (payload.authenticated) {
        notifyAvailabilityChange();
        scheduleRefresh();
        void notificationState.refresh();
      }
    });
    socket.on('disconnect', () => {
      connected = false;
    });
    const fallback = setInterval(() => {
      if (!connected && AppState.currentState === 'active') {
        notifyAvailabilityChange();
        scheduleRefresh();
        void notificationState.refresh();
      }
    }, 45_000);
    socket.on('system:error', () => {
      void refreshAccessToken();
    });
    for (const name of EVENT_NAMES) {
      socket.on(name, (payload?: { lodgeId?: string }) => {
        if (name === 'room:availability-updated') {
          notifyAvailabilityChange(payload?.lodgeId);
          return;
        }
        if (name.startsWith('booking:')) requestPaymentReconciliation();
        if (name.startsWith('notification:')) {
          void notificationState.refresh();
          return;
        }
        scheduleRefresh();
        const message = realtimeMessages[name];
        if (message) toastRef.current(translate.current(message));
      });
    }

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(fallback);
      socket?.disconnect();
    };
  }, [accessToken]);

  return children;
}

export { extraStrings };
