import { allReportPages, type ReportDateRange } from '@tuljai/shared';
import type {
  BookingReportRow,
  CommissionSummary,
  LodgeCommissionFinanceReport,
} from '@tuljai/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useRealtime } from '../../../realtime/realtime-provider';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import {
  getOwnerBookingReport,
  getOwnerCommissionFinanceReport,
  getOwnerCommissionReport,
} from '../api/owner-reports-api';

const EVENTS = new Set([
  'booking:new',
  'booking:accepted',
  'booking:cancelled',
  'booking:rejected',
  'booking:expired',
  'checkin:completed',
  'checkout:completed',
  'dashboard:update',
]);
interface State {
  bookingRows: BookingReportRow[];
  commissionRows: CommissionSummary[];
  commissionFinance: LodgeCommissionFinanceReport | null;
  errorMessage: string | null;
  financeError: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}
export function useOwnerReports(range: ReportDateRange, reportType: 'all' | 'completed') {
  const assigned = useAssignedLodges();
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const lodgeId = assigned.selectedLodge?.id;
  const revision = useRef(0);
  const [state, setState] = useState<State>({
    bookingRows: [],
    commissionRows: [],
    commissionFinance: null,
    errorMessage: null,
    financeError: null,
    isLoading: true,
    isRefreshing: false,
  });
  const load = useCallback(
    async (refreshing = false) => {
      const current = ++revision.current;
      if (assigned.isLoading) return;
      if (isOffline || !lodgeId) {
        setState({
          bookingRows: [],
          commissionRows: [],
          commissionFinance: null,
          financeError: null,
          errorMessage: isOffline
            ? 'Connect to the internet to load and export reports.'
            : (assigned.errorMessage ?? 'No lodge assigned yet.'),
          isLoading: false,
          isRefreshing: false,
        });
        return;
      }
      setState((previous) => ({
        ...previous,
        errorMessage: null,
        financeError: null,
        isLoading: !refreshing,
        isRefreshing: refreshing,
      }));
      try {
        const query = { lodgeId, ...range, reportType, limit: 500 };
        const [bookingRows, commissionRows, finance] = await Promise.all([
          allReportPages((page) => getOwnerBookingReport({ ...query, page })),
          getOwnerCommissionReport(query),
          getOwnerCommissionFinanceReport(lodgeId).then(
            (value) => ({ value, error: null }),
            () => ({
              value: null,
              error: 'Commission history could not be loaded. Pull down to retry.',
            }),
          ),
        ]);
        if (current !== revision.current) return;
        setState({
          bookingRows,
          commissionRows,
          commissionFinance: finance.value,
          financeError: finance.error,
          errorMessage: null,
          isLoading: false,
          isRefreshing: false,
        });
      } catch {
        if (current !== revision.current) return;
        setState({
          bookingRows: [],
          commissionRows: [],
          commissionFinance: null,
          financeError: null,
          errorMessage: 'Reports could not be loaded. Pull down to retry.',
          isLoading: false,
          isRefreshing: false,
        });
      }
    },
    [
      assigned.isLoading,
      assigned.errorMessage,
      isOffline,
      lodgeId,
      range.startDate,
      range.endDate,
      reportType,
    ],
  );
  useEffect(() => {
    void load();
    return () => {
      revision.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!realtime.lastEvent || !EVENTS.has(realtime.lastEvent.name)) return;
    const timeout = setTimeout(() => void load(true), 750);
    return () => clearTimeout(timeout);
  }, [load, realtime.lastEvent]);
  useEffect(() => {
    if (realtime.connectionRevision) void load(true);
  }, [load, realtime.connectionRevision]);
  const summary = useMemo(
    () => ({
      totalBookings: state.bookingRows.length,
      completedBookings: state.bookingRows.filter((row) =>
        ['CHECKED_OUT', 'COMPLETED'].includes(row.status),
      ).length,
      estimatedRevenue: state.bookingRows.reduce(
        (sum, row) => sum + Number(row.totalAmount ?? 0),
        0,
      ),
      estimatedCommission: state.bookingRows.reduce(
        (sum, row) => sum + Number(row.commissionAmount ?? 0),
        0,
      ),
    }),
    [state.bookingRows, state.commissionRows],
  );
  return {
    ...state,
    registerRows: state.bookingRows,
    summary,
    selectedLodge: assigned.selectedLodge,
    isOffline,
    refresh: () => load(true),
  };
}
