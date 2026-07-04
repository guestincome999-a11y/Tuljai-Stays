import type { QrScanLogEntry, QrScanResult } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { listQrScanHistory } from '../api/checkin-api';

type ScanHistoryFilter = 'TODAY' | 'WEEK' | 'SUCCESS' | 'FAILED';

interface ScanHistoryState {
  data: QrScanLogEntry[];
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export function useScanHistory(filter: ScanHistoryFilter) {
  const assignedLodges = useAssignedLodges();
  const lodgeId = assignedLodges.selectedLodge?.id ?? null;
  const [state, setState] = useState<ScanHistoryState>({
    data: [],
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
  });

  const load = useCallback(
    async (refreshing = false) => {
      if (!lodgeId) {
        setState({
          data: [],
          errorMessage: 'Select a lodge to view scan history.',
          isLoading: false,
          isRefreshing: false,
        });
        return;
      }

      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && current.data.length === 0,
        isRefreshing: refreshing,
      }));

      try {
        const result = await listQrScanHistory({
          limit: 50,
          lodgeId,
          page: 1,
          ...getFilterQuery(filter),
        });
        setState({
          data: result.items,
          errorMessage: null,
          isLoading: false,
          isRefreshing: false,
        });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Scan history could not be loaded.',
          isLoading: false,
          isRefreshing: false,
        }));
      }
    },
    [filter, lodgeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    ...state,
    refresh: () => load(true),
  };
}

function getFilterQuery(filter: ScanHistoryFilter): {
  fromDate?: string;
  result?: QrScanResult;
} {
  if (filter === 'SUCCESS') {
    return { result: 'SUCCESS' };
  }

  const from = new Date();

  if (filter === 'TODAY') {
    from.setHours(0, 0, 0, 0);
    return { fromDate: from.toISOString() };
  }

  from.setDate(from.getDate() - 7);
  return { fromDate: from.toISOString() };
}
