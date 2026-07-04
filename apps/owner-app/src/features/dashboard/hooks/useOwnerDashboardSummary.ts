import type { OwnerDashboardSummary } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

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
        await saveDashboardSummaryCache(data).catch(() => undefined);
        setState({ data, errorMessage: null, isLoading: false, isRefreshing: false });
      } catch {
        const cached = await loadDashboardSummaryCache().catch(() => null);
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
    [auth.isAuthenticated, isOffline],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const eventName = realtime.lastEvent?.name;

    if (
      eventName === 'booking:new' ||
      eventName === 'owner:alert' ||
      eventName === 'booking:accepted' ||
      eventName === 'booking:rejected' ||
      eventName === 'booking:expired' ||
      eventName === 'checkin:completed' ||
      eventName === 'checkout:completed' ||
      eventName === 'room:availability-updated' ||
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

  return {
    ...state,
    refresh: () => load(true),
  };
}
