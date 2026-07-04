import type { GuestRegister } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { listGuestRegisters } from '../../checkin/api/checkin-api';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';

interface ReceptionSnapshotState {
  errorMessage: string | null;
  isLoading: boolean;
  todayCheckIns: GuestRegister[];
  todayCheckOuts: GuestRegister[];
  upcomingCheckOuts: GuestRegister[];
}

export function useReceptionSnapshot() {
  const assignedLodges = useAssignedLodges();
  const lodgeId = assignedLodges.selectedLodge?.id ?? null;
  const [state, setState] = useState<ReceptionSnapshotState>({
    errorMessage: null,
    isLoading: true,
    todayCheckIns: [],
    todayCheckOuts: [],
    upcomingCheckOuts: [],
  });

  const load = useCallback(async () => {
    if (!lodgeId) {
      setState({
        errorMessage: null,
        isLoading: false,
        todayCheckIns: [],
        todayCheckOuts: [],
        upcomingCheckOuts: [],
      });
      return;
    }

    setState((current) => ({ ...current, errorMessage: null, isLoading: true }));

    try {
      const today = new Date().toISOString().slice(0, 10);
      const [checkIns, checkOuts, upcoming] = await Promise.all([
        listGuestRegisters({ date: today, limit: 3, lodgeId, page: 1, status: 'CHECKED_IN' }),
        listGuestRegisters({ date: today, limit: 3, lodgeId, page: 1, status: 'CHECKED_OUT' }),
        listGuestRegisters({ limit: 3, lodgeId, page: 1, status: 'CHECKED_IN' }),
      ]);
      setState({
        errorMessage: null,
        isLoading: false,
        todayCheckIns: checkIns.items,
        todayCheckOuts: checkOuts.items,
        upcomingCheckOuts: upcoming.items,
      });
    } catch {
      setState((current) => ({
        ...current,
        errorMessage: 'Reception snapshot could not be loaded.',
        isLoading: false,
      }));
    }
  }, [lodgeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    ...state,
    refresh: load,
  };
}
