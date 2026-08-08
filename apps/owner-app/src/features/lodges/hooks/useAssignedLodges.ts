import type { Lodge } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../../auth/auth-context';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useRealtime } from '../../../realtime/realtime-provider';
import { listAssignedLodges } from '../api/owner-lodges-api';
import {
  getCachedSelectedLodge,
  getSelectedLodgeId,
  saveSelectedLodge,
} from '../storage/selected-lodge-store';

interface AssignedLodgesState {
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  lodges: Lodge[];
  selectedLodge: Lodge | null;
}

export function useAssignedLodges() {
  const auth = useAuth();
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const [state, setState] = useState<AssignedLodgesState>({
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
    lodges: [],
    selectedLodge: null,
  });

  const load = useCallback(
    async (refreshing = false) => {
      if (!auth.isAuthenticated) {
        setState({
          errorMessage: null,
          isLoading: false,
          isRefreshing: false,
          lodges: [],
          selectedLodge: null,
        });
        return;
      }

      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && !current.selectedLodge,
        isRefreshing: refreshing,
      }));

      if (isOffline) {
        const cached = await getCachedSelectedLodge().catch(() => null);
        setState((current) => ({
          ...current,
          errorMessage: cached ? null : 'Assigned lodges need internet for first-time loading.',
          isLoading: false,
          isRefreshing: false,
          lodges: cached ? [cached] : [],
          selectedLodge: cached,
        }));
        return;
      }

      try {
        const lodges = await listAssignedLodges();
        const storedLodgeId = await getSelectedLodgeId();
        const selectedLodge =
          lodges.find((lodge) => lodge.id === storedLodgeId) ?? lodges[0] ?? null;

        if (selectedLodge) {
          await saveSelectedLodge(selectedLodge).catch(() => undefined);
        }

        setState({
          errorMessage: lodges.length === 0 ? 'No lodge assigned yet.' : null,
          isLoading: false,
          isRefreshing: false,
          lodges,
          selectedLodge,
        });
      } catch {
        const cached = await getCachedSelectedLodge().catch(() => null);
        setState((current) => ({
          ...current,
          errorMessage: cached
            ? 'Showing last selected lodge. Refresh when you are online.'
            : 'Could not load assigned lodges. Please try again.',
          isLoading: false,
          isRefreshing: false,
          lodges: cached ? [cached] : [],
          selectedLodge: cached,
        }));
      }
    },
    [auth.isAuthenticated, isOffline],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (realtime.lastEvent?.name === 'lodge:catalog-updated') {
      void load(true);
    }
  }, [load, realtime.lastEvent]);

  return {
    ...state,
    refresh: () => load(true),
  };
}
