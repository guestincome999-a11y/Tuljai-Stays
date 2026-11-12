import type { OwnerDashboardSummary } from '@tuljai/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../../../auth/auth-context';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { getEventBookingId } from '../../../realtime/realtime-events';
import { useRealtime } from '../../../realtime/realtime-provider';
import { getOwnerDashboardSummary } from '../api/owner-dashboard-api';
import {
  loadDashboardSummaryCache,
  saveDashboardSummaryCache,
} from '../storage/dashboard-summary-cache';

interface DashboardSummaryState {
  data: OwnerDashboardSummary | null;
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export function useOwnerDashboardSummary() {
  const auth = useAuth();
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current += 1;
    },
    [],
  );
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const [state, setState] = useState<DashboardSummaryState>({
    data: null,
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
  });

  const load = useCallback(
    async (refreshing = false) => {
      const request = ++revision.current;
      if (!auth.isAuthenticated) {
        setState({ data: null, errorMessage: null, isLoading: false, isRefreshing: false });
        return;
      }

      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && !current.data,
        isRefreshing: refreshing,
      }));

      if (isOffline) {
        const cached = await loadDashboardSummaryCache().catch(() => null);
        if (request !== revision.current) return;
        setState((current) => ({
          ...current,
          data: current.data ?? cached,
          errorMessage: cached ? null : 'Connect to the internet to load dashboard summary.',
          isLoading: false,
          isRefreshing: false,
        }));
        return;
      }

      try {
        const data = await getOwnerDashboardSummary();
        if (request !== revision.current) return;
        await saveDashboardSummaryCache(data).catch(() => undefined);
        if (request !== revision.current) return;
        setState({ data, errorMessage: null, isLoading: false, isRefreshing: false });
      } catch {
        const cached = await loadDashboardSummaryCache().catch(() => null);
        if (request !== revision.current) return;
        setState((current) => ({
          ...current,
          data: current.data ?? cached,
          errorMessage: cached
            ? 'Showing last dashboard summary. Refresh when online.'
            : 'Dashboard summary could not be loaded.',
          isLoading: false,
          isRefreshing: false,
        }));
      }
    },
    [auth.isAuthenticated, auth.user?.id, isOffline],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const eventName = realtime.lastEvent?.name;

    if (
      eventName === 'booking:new' ||
      eventName === 'owner:alert' ||
      eventName === 'booking:accepted' ||
      eventName === 'booking:cancelled' ||
      eventName === 'booking:rejected' ||
      eventName === 'booking:expired' ||
      eventName === 'checkin:completed' ||
      eventName === 'checkout:completed' ||
      eventName === 'room:availability-updated' ||
      eventName === 'room:status-updated' ||
      eventName === 'dashboard:update' ||
      eventName === 'notification:new' ||
      eventName === 'notification:unread-count'
    ) {
      const timeout = setTimeout(
        () => {
          void load(true);
        },
        getEventBookingId(realtime.lastEvent) ? 500 : 1000,
      );

      return () => clearTimeout(timeout);
    }

    return undefined;
  }, [load, realtime.lastEvent]);

  useEffect(() => {
    if (realtime.connectionRevision === 0) {
      return;
    }

    void load(true);
  }, [load, realtime.connectionRevision]);

  useEffect(() => {
    if (realtime.connected || isOffline || !auth.isAuthenticated) {
      return undefined;
    }

    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void load(true);
    }, 30_000);
    return () => clearInterval(interval);
  }, [auth.isAuthenticated, isOffline, load, realtime.connected]);

  return {
    ...state,
    refresh: () => load(true),
  };
}
