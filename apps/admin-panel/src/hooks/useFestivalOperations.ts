'use client';

import type { FestivalOperationsSnapshot } from '@tuljai/types';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getFestivalOperations, type FestivalQuery } from '../api/festival-operations-api';
import {
  createAdminRealtimeSocket,
  subscribeAdminRealtimeEvents,
  subscribeAdminRealtimeSessionRecovery,
} from '../api/realtime-client';
import { useAdminAuth } from '../auth/AdminAuthProvider';

export function useFestivalOperations(query: FestivalQuery) {
  const auth = useAdminAuth();
  const token = auth.session.tokens?.accessToken;
  const [data, setData] = useState<FestivalOperationsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const generation = useRef(0);
  const pending = useRef<{ key: string; request: Promise<void> } | null>(null);
  const key = JSON.stringify(query);
  const queryRef = useRef(query);
  queryRef.current = query;
  const refresh = useCallback((): Promise<void> => {
    if (pending.current?.key === key) return pending.current.request;
    const id = ++generation.current;
    setRefreshing(true);
    const request = getFestivalOperations(queryRef.current)
      .then((next) => {
        if (id !== generation.current) return;
        setData(next);
        setError(null);
      })
      .catch(() => {
        if (id === generation.current)
          setError(
            'Operational data could not be synchronized. Previous values may be stale. Retry when connected.',
          );
      })
      .finally(() => {
        if (id === generation.current) setRefreshing(false);
        if (pending.current?.request === request) pending.current = null;
      });
    pending.current = { key, request };
    return request;
  }, [key]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
      pending.current = null;
    };
  }, [refresh]);
  useEffect(() => {
    if (!token) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        void refreshRef.current();
      }, 700);
    };
    const socket = createAdminRealtimeSocket(token);
    socket.on('connection:ready', (payload) => {
      setConnected(Boolean(payload.authenticated));
      if (payload.authenticated) schedule();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    subscribeAdminRealtimeSessionRecovery(socket, auth.refreshSession);
    subscribeAdminRealtimeEvents(socket, schedule);
    return () => {
      socket.disconnect();
      setConnected(false);
      if (timer) clearTimeout(timer);
    };
  }, [token, auth.refreshSession]);
  useEffect(() => {
    const recover = () => {
      if (document.visibilityState === 'visible') void refreshRef.current();
    };
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', recover);
    // Slow reconciliation also catches missed packets while a socket still appears connected.
    const timer = setInterval(recover, connected ? 60000 : 45000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [connected]);
  return { data, error, refreshing, connected, refresh };
}
