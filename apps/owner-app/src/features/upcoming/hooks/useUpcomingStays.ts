import type { GuestRegister, OwnerBookingSummary } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useRealtime } from '../../../realtime/realtime-provider';
import { listOwnerBookings } from '../../bookings/api/owner-bookings-api';
import { listGuestRegisters } from '../../checkin/api/checkin-api';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';

interface UpcomingState {
  checkIns: OwnerBookingSummary[];
  checkOuts: GuestRegister[];
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export function useUpcomingStays() {
  const assignedLodges = useAssignedLodges();
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const lodgeId = assignedLodges.selectedLodge?.id ?? null;
  const [state, setState] = useState<UpcomingState>({
    checkIns: [],
    checkOuts: [],
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
  });

  const load = useCallback(
    async (refreshing = false) => {
      if (!lodgeId) {
        setState({
          checkIns: [],
          checkOuts: [],
          errorMessage: 'No lodge selected.',
          isLoading: false,
          isRefreshing: false,
        });
        return;
      }

      if (isOffline) {
        setState((current) => ({
          ...current,
          errorMessage: 'Connect to the internet to load upcoming stays.',
          isLoading: false,
          isRefreshing: false,
        }));
        return;
      }

      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && current.checkIns.length === 0 && current.checkOuts.length === 0,
        isRefreshing: refreshing,
      }));

      try {
        const [accepted, qrReady, registers] = await Promise.all([
          listOwnerBookings({ limit: 80, lodgeId, page: 1, status: 'ACCEPTED' }),
          listOwnerBookings({ limit: 80, lodgeId, page: 1, status: 'QR_GENERATED' }),
          listGuestRegisters({ limit: 80, lodgeId, page: 1, status: 'CHECKED_IN' }),
        ]);
        setState({
          checkIns: [...accepted.items, ...qrReady.items],
          checkOuts: registers.items,
          errorMessage: null,
          isLoading: false,
          isRefreshing: false,
        });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Upcoming check-ins and check-outs could not be loaded.',
          isLoading: false,
          isRefreshing: false,
        }));
      }
    },
    [isOffline, lodgeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const eventName = realtime.lastEvent?.name;
    if (
      eventName?.startsWith('booking:') ||
      eventName === 'checkin:completed' ||
      eventName === 'checkout:completed' ||
      eventName === 'qr:scan-success'
    ) {
      void load(true);
    }
  }, [load, realtime.lastEvent]);

  const sortedCheckIns = useMemo(
    () =>
      [...state.checkIns]
        .filter((booking) => booking.checkInDate >= new Date().toISOString().slice(0, 10))
        .sort((left, right) => left.checkInDate.localeCompare(right.checkInDate)),
    [state.checkIns],
  );
  const sortedCheckOuts = useMemo(
    () =>
      [...state.checkOuts].sort((left, right) =>
        (left.expectedCheckoutAt ?? '').localeCompare(right.expectedCheckoutAt ?? ''),
      ),
    [state.checkOuts],
  );

  return {
    ...state,
    checkIns: sortedCheckIns,
    checkOuts: sortedCheckOuts,
    refresh: () => load(true),
    selectedLodge: assignedLodges.selectedLodge,
  };
}
