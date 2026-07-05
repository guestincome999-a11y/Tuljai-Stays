import type { BookingReportRow, CommissionSummary } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useOwnerDashboardSummary } from '../../dashboard/hooks/useOwnerDashboardSummary';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import {
  getOwnerBookingReport,
  getOwnerCommissionReport,
  getOwnerRegisterReport,
} from '../api/owner-reports-api';

interface OwnerReportsState {
  bookingRows: BookingReportRow[];
  commissionRows: CommissionSummary[];
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  registerRows: BookingReportRow[];
}

export function useOwnerReports() {
  const assignedLodges = useAssignedLodges();
  const dashboard = useOwnerDashboardSummary();
  const { isOffline } = useConnectivity();
  const lodgeId = assignedLodges.selectedLodge?.id;
  const [state, setState] = useState<OwnerReportsState>({
    bookingRows: [],
    commissionRows: [],
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
    registerRows: [],
  });

  const load = useCallback(
    async (refreshing = false) => {
      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && current.bookingRows.length === 0,
        isRefreshing: refreshing,
      }));

      if (isOffline) {
        setState((current) => ({
          ...current,
          errorMessage: 'Connect to the internet to load reports.',
          isLoading: false,
          isRefreshing: false,
        }));
        return;
      }

      const range = getWeekRange();

      try {
        const [bookingReport, registerReport, commissionReport] = await Promise.all([
          getOwnerBookingReport({ lodgeId, ...range }),
          getOwnerRegisterReport({ lodgeId, ...range }),
          getOwnerCommissionReport({ lodgeId, ...range }),
        ]);
        setState({
          bookingRows: bookingReport.items,
          commissionRows: commissionReport,
          errorMessage: null,
          isLoading: false,
          isRefreshing: false,
          registerRows: registerReport.items,
        });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Reports could not be loaded right now.',
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

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayBookings = state.bookingRows.filter((row) => row.checkInDate === today).length;
    const completedBookings = state.bookingRows.filter((row) =>
      ['CHECKED_OUT', 'COMPLETED'].includes(row.status),
    ).length;
    const cancelledOrRejectedBookings = state.bookingRows.filter((row) =>
      ['CANCELLED', 'REJECTED'].includes(row.status),
    ).length;
    const estimatedRevenue = state.bookingRows.reduce(
      (total, row) => total + parseAmount(row.totalAmount),
      0,
    );
    const estimatedCommission = state.commissionRows.reduce(
      (total, row) => total + parseAmount(row.commissionTotal),
      0,
    );

    return {
      cancelledOrRejectedBookings,
      checkInsCheckouts: dashboard.data
        ? `${dashboard.data.checkedInGuests}/${dashboard.data.todayCheckOuts}`
        : '0/0',
      completedBookings,
      estimatedCommission,
      estimatedRevenue,
      occupancyEstimate: dashboard.data
        ? getOccupancyEstimate(dashboard.data.occupiedRooms, dashboard.data.availableRooms)
        : 0,
      thisWeekBookings: state.bookingRows.length,
      todayBookings,
    };
  }, [dashboard.data, state.bookingRows, state.commissionRows]);

  return {
    ...state,
    refresh: () => {
      void dashboard.refresh();
      return load(true);
    },
    selectedLodge: assignedLodges.selectedLodge,
    summary,
  };
}

function getWeekRange(): { endDate: string; startDate: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return {
    endDate: end.toISOString().slice(0, 10),
    startDate: start.toISOString().slice(0, 10),
  };
}

function parseAmount(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getOccupancyEstimate(occupiedRooms: number, availableRooms: number): number {
  const total = occupiedRooms + availableRooms;

  if (total === 0) {
    return 0;
  }

  return Math.round((occupiedRooms / total) * 100);
}
