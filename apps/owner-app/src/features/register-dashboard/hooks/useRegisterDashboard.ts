import type { GuestRegister, GuestRegisterStatus, Room } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { listGuestRegisters } from '../../checkin/api/checkin-api';
import { useOwnerDashboardSummary } from '../../dashboard/hooks/useOwnerDashboardSummary';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { listRooms } from '../../rooms/api/owner-rooms-api';
import {
  loadRegisterDashboardCache,
  saveRegisterDashboardCache,
} from '../storage/register-dashboard-cache';

export type RegisterQuickFilter =
  'ALL' | 'TODAY' | 'CHECKED_IN' | 'CHECKED_OUT' | 'UPCOMING_CHECKOUT' | 'THIS_WEEK';

interface RegisterDashboardState {
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  registers: GuestRegister[];
  rooms: Room[];
}

export function useRegisterDashboard(searchText: string, filter: RegisterQuickFilter) {
  const assignedLodges = useAssignedLodges();
  const dashboard = useOwnerDashboardSummary();
  const lodgeId = assignedLodges.selectedLodge?.id ?? null;
  const { isOffline } = useConnectivity();
  const [state, setState] = useState<RegisterDashboardState>({
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
    registers: [],
    rooms: [],
  });

  const load = useCallback(
    async (refreshing = false) => {
      if (!lodgeId) {
        setState({
          errorMessage: 'No lodge selected.',
          isLoading: false,
          isRefreshing: false,
          registers: [],
          rooms: [],
        });
        return;
      }

      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && current.registers.length === 0,
        isRefreshing: refreshing,
      }));

      if (isOffline) {
        const cached = await loadRegisterDashboardCache().catch(() => []);
        setState((current) => ({
          ...current,
          errorMessage: cached.length
            ? null
            : 'Connect to the internet to load register dashboard.',
          isLoading: false,
          isRefreshing: false,
          registers: cached,
        }));
        return;
      }

      try {
        const today = new Date().toISOString().slice(0, 10);
        const [registerResponse, roomResponse] = await Promise.all([
          listGuestRegisters({
            date: filter === 'TODAY' ? today : undefined,
            limit: 80,
            lodgeId,
            page: 1,
            status: getStatusForFilter(filter),
          }),
          listRooms(lodgeId),
        ]);

        setState({
          errorMessage: null,
          isLoading: false,
          isRefreshing: false,
          registers: registerResponse.items,
          rooms: roomResponse,
        });
        await saveRegisterDashboardCache(registerResponse.items).catch(() => undefined);
      } catch {
        const cached = await loadRegisterDashboardCache().catch(() => []);
        setState((current) => ({
          ...current,
          errorMessage: cached.length
            ? 'Showing last saved register dashboard. Refresh when online.'
            : 'Register dashboard could not be loaded.',
          isLoading: false,
          isRefreshing: false,
          registers: cached,
        }));
      }
    },
    [filter, isOffline, lodgeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRegisters = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);

    return state.registers.filter((register) => {
      if (filter === 'UPCOMING_CHECKOUT' && !isUpcomingCheckout(register, now, weekEnd)) {
        return false;
      }

      if (filter === 'THIS_WEEK' && !isWithinThisWeek(register, now, weekEnd)) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [
        register.bookingCode,
        register.registerCode,
        register.primaryGuestName,
        register.primaryGuestPhone,
        register.roomNumber,
        register.status,
        register.expectedCheckoutAt,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [filter, searchText, state.registers]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const checkedIn = state.registers.filter((item) => item.status === 'CHECKED_IN');
    const checkedOut = state.registers.filter((item) => item.status === 'CHECKED_OUT');
    const todayArrivals = state.registers.filter((item) => item.checkInAt.slice(0, 10) === today);
    const todayDepartures = state.registers.filter(
      (item) => item.actualCheckoutAt?.slice(0, 10) === today,
    );
    const pendingCheckIns = Math.max((dashboard.data?.acceptedBookings ?? 0) - checkedIn.length, 0);

    return {
      checkedInCount: checkedIn.length,
      checkedOutCount: checkedOut.length,
      guestsCurrentlyStaying: checkedIn.reduce((total, item) => total + item.totalGuests, 0),
      pendingCheckIns,
      roomsRequiringCleaning: state.rooms.filter((room) => room.status === 'CLEANING').length,
      roomsUnderMaintenance: state.rooms.filter((room) => room.status === 'MAINTENANCE').length,
      todayArrivals: todayArrivals.length,
      todayDepartures: todayDepartures.length,
      upcomingCheckoutReminders: checkedIn.filter((item) => item.expectedCheckoutAt).length,
    };
  }, [dashboard.data?.acceptedBookings, state.registers, state.rooms]);

  return {
    ...state,
    filteredRegisters,
    isOffline,
    refresh: () => {
      void dashboard.refresh();
      return load(true);
    },
    selectedLodge: assignedLodges.selectedLodge,
    summary,
  };
}

function getStatusForFilter(filter: RegisterQuickFilter): GuestRegisterStatus | undefined {
  if (filter === 'CHECKED_IN' || filter === 'UPCOMING_CHECKOUT') {
    return 'CHECKED_IN';
  }

  if (filter === 'CHECKED_OUT') {
    return 'CHECKED_OUT';
  }

  return undefined;
}

function isUpcomingCheckout(register: GuestRegister, now: Date, weekEnd: Date): boolean {
  if (!register.expectedCheckoutAt || register.status !== 'CHECKED_IN') {
    return false;
  }

  const checkoutAt = new Date(register.expectedCheckoutAt);
  return checkoutAt >= now && checkoutAt <= weekEnd;
}

function isWithinThisWeek(register: GuestRegister, now: Date, weekEnd: Date): boolean {
  const checkInAt = new Date(register.checkInAt);
  return checkInAt >= now && checkInAt <= weekEnd;
}
