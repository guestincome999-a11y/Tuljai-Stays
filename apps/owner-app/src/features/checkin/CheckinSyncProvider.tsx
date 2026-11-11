import type { CheckInResponse } from '@tuljai/types';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../../auth/auth-context';
import { useConnectivity } from '../../connectivity/connectivity-context';
import { getOrCreateDeviceId } from '../../device/device-identity';
import { clearBookingScanCache } from '../bookings/api/owner-bookings-api';

import { scanQrCode } from './api/checkin-api';
import { CheckinQueue } from './scan-operation';
import { checkinQueueStorage } from './storage/checkin-queue-store';

const Context = createContext<{
  queue: CheckinQueue | null;
  ready: boolean;
  error: string | null;
  revision: number;
}>({ queue: null, ready: false, error: null, revision: 0 });

export function CheckinSyncProvider({
  children,
  onConfirmed,
}: {
  children: ReactNode;
  onConfirmed: (response: CheckInResponse) => void;
}) {
  const auth = useAuth();
  const { isOffline } = useConnectivity();
  const confirmed = useRef(onConfirmed);
  confirmed.current = onConfirmed;
  const [queue, setQueue] = useState<CheckinQueue | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const userId = auth.isAuthenticated ? auth.user?.id : null;

  useEffect(() => {
    setReady(false);
    setError(null);
    clearBookingScanCache();
    if (!userId) {
      setQueue(null);
      return;
    }
    const next = new CheckinQueue({
      ...checkinQueueStorage(userId),
      send: async (qr) =>
        scanQrCode({
          deviceId: await getOrCreateDeviceId(),
          qrPayload: qr.qrPayload,
        }),
      confirmed: (response) => confirmed.current(response),
    });
    setQueue(next);
    const unsubscribe = next.subscribe(() => setRevision((value) => value + 1));
    let disposed = false;
    void next
      .restore()
      .then(() => {
        if (!disposed) setReady(true);
      })
      .catch(() => {
        if (!disposed) setError('Pending scans could not be restored. Reopen the app to retry.');
      });
    const interval = setInterval(() => {
      void next.flush();
    }, 15000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void next.flush();
    });
    return () => {
      disposed = true;
      next.stop();
      unsubscribe();
      clearInterval(interval);
      appState.remove();
    };
  }, [userId]);

  useEffect(() => {
    queue?.setOnline(!isOffline && auth.isAuthenticated);
  }, [queue, isOffline, auth.isAuthenticated]);
  return <Context.Provider value={{ queue, ready, error, revision }}>{children}</Context.Provider>;
}

export function useCheckinSync() {
  return useContext(Context);
}
