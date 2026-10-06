'use client';

import type {
  AdminBookingSummary,
  AdminBookingTrendPoint,
  AdminDashboardInsights,
  AdminDashboardKpis,
  AdminDashboardOperations,
  AdminDashboardPeriod,
} from '@tuljai/types';
import { useEffect, useState } from 'react';

import {
  getAdminBookingTrend,
  getAdminDashboardInsights,
  getAdminDashboardKpis,
  getAdminDashboardOperations,
  listAdminBookings,
} from '../../api/live-operations-api';

const REFRESH_MS = 60_000;

export interface DashboardData {
  failed: boolean;
  insights: AdminDashboardInsights | null;
  kpis: AdminDashboardKpis | null;
  operations: AdminDashboardOperations | null;
  recent: AdminBookingSummary[] | null;
  trend: AdminBookingTrendPoint[] | null;
}

/** Loads every dashboard panel independently so one failing endpoint never blanks the rest. */
export function useDashboardData(period: AdminDashboardPeriod): DashboardData {
  const [kpis, setKpis] = useState<AdminDashboardKpis | null>(null);
  const [trend, setTrend] = useState<AdminBookingTrendPoint[] | null>(null);
  const [recent, setRecent] = useState<AdminBookingSummary[] | null>(null);
  const [operations, setOperations] = useState<AdminDashboardOperations | null>(null);
  const [insights, setInsights] = useState<AdminDashboardInsights | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      void Promise.allSettled([
        getAdminDashboardKpis(),
        getAdminBookingTrend(7),
        listAdminBookings({ limit: 5 }),
        getAdminDashboardOperations(),
      ]).then(([k, t, r, o]) => {
        if (!active) return;
        if (k.status === 'fulfilled') setKpis(k.value);
        if (t.status === 'fulfilled') setTrend(t.value);
        if (r.status === 'fulfilled') setRecent(r.value.items);
        if (o.status === 'fulfilled') setOperations(o.value);
        setFailed([k, t, r, o].some((result) => result.status === 'rejected'));
      });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => {
      getAdminDashboardInsights(period)
        .then((result) => {
          if (active) setInsights(result);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    };
    setInsights(null);
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [period]);

  return { failed, insights, kpis, operations, recent, trend };
}
