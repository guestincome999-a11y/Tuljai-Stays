'use client';

import type {
  AdminBookingSummary,
  AdminDashboardSummary,
  Announcement,
  FeatureFlag,
  Lodge,
  NotificationMetrics,
  PresenceSummary,
  QrScanLogEntry,
  SystemSetting,
} from '@tuljai/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getAdminDashboardSummary,
  getNotificationMetrics,
  getPresenceSummary,
  listAdminBookings,
  listEmergencyAnnouncements,
  listPublicFeatureFlags,
  listAdminLodges,
  listPublicSettings,
  listQrScanLogs,
} from '../api/live-operations-api';
import {
  createAdminRealtimeSocket,
  subscribeAdminRealtimeEvents,
  type AdminRealtimeEvent,
} from '../api/realtime-client';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { tokenStorage } from '../auth/token-storage';

interface LiveOperationsState {
  announcements: Announcement[];
  bookings: AdminBookingSummary[];
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdatedAt: Date | null;
  lodges: Lodge[];
  notificationMetrics: NotificationMetrics | null;
  presence: PresenceSummary | null;
  qrScans: QrScanLogEntry[];
  settings: SystemSetting[];
  featureFlags: FeatureFlag[];
  summary: AdminDashboardSummary | null;
}

export function useLiveOperations() {
  const auth = useAdminAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<AdminRealtimeEvent | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<LiveOperationsState>({
    announcements: [],
    bookings: [],
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
    lastUpdatedAt: null,
    lodges: [],
    notificationMetrics: null,
    presence: null,
    qrScans: [],
    settings: [],
    featureFlags: [],
    summary: null,
  });

  const load = useCallback(async (refreshing = false) => {
    setState((current) => ({
      ...current,
      errorMessage: null,
      isLoading: !refreshing && !current.summary,
      isRefreshing: refreshing,
    }));

    try {
      const [
        summary,
        presence,
        notificationMetrics,
        bookings,
        lodges,
        qrScans,
        announcements,
        settings,
        featureFlags,
      ] = await Promise.all([
        getAdminDashboardSummary(),
        getPresenceSummary().catch(() => null),
        getNotificationMetrics().catch(() => null),
        listAdminBookings({ limit: 16 }).catch(() => ({
          items: [],
          page: 1,
          pageSize: 16,
          totalItems: 0,
          totalPages: 0,
        })),
        listAdminLodges().catch(() => ({
          items: [],
          page: 1,
          pageSize: 18,
          totalItems: 0,
          totalPages: 0,
        })),
        listQrScanLogs().catch(() => ({
          items: [],
          page: 1,
          pageSize: 40,
          totalItems: 0,
          totalPages: 0,
        })),
        listEmergencyAnnouncements().catch(() => ({
          items: [],
          page: 1,
          pageSize: 5,
          totalItems: 0,
          totalPages: 0,
        })),
        listPublicSettings().catch(() => []),
        listPublicFeatureFlags().catch(() => []),
      ]);

      setState({
        announcements: announcements.items,
        bookings: bookings.items,
        errorMessage: null,
        isLoading: false,
        isRefreshing: false,
        lastUpdatedAt: new Date(),
        lodges: lodges.items,
        notificationMetrics,
        presence,
        qrScans: qrScans.items,
        settings,
        featureFlags,
        summary,
      });
    } catch {
      setState((current) => ({
        ...current,
        errorMessage: 'Live operations data could not be loaded. Please retry.',
        isLoading: false,
        isRefreshing: false,
      }));
    }
  }, []);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      void load(true);
    }, 900);
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.session.tokens?.accessToken) {
      setConnected(false);
      return undefined;
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? '';

    if (!apiBaseUrl) {
      setConnected(false);
      return undefined;
    }

    let mounted = true;
    let socketCleanup: (() => void) | null = null;

    async function connect() {
      const accessToken = await tokenStorage.getAccessToken();

      if (!accessToken || !mounted) {
        return;
      }

      const socket = createAdminRealtimeSocket(accessToken, apiBaseUrl);
      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));
      subscribeAdminRealtimeEvents(socket, (event) => {
        setLastEvent(event);
        scheduleRealtimeRefresh();
      });
      socketCleanup = () => {
        socket.disconnect();
        setConnected(false);
      };
    }

    void connect();

    return () => {
      mounted = false;
      socketCleanup?.();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [auth.isAuthenticated, auth.session.tokens?.accessToken, scheduleRealtimeRefresh]);

  useEffect(() => {
    if (connected) {
      return undefined;
    }

    const interval = setInterval(() => {
      void load(true);
    }, 45000);

    return () => clearInterval(interval);
  }, [connected, load]);

  const festivalModeEnabled = useMemo(
    () =>
      state.featureFlags.some((flag) => flag.key === 'festival_mode' && flag.enabled) ||
      state.settings.some((setting) => setting.key === 'festival_mode' && setting.value === true),
    [state.featureFlags, state.settings],
  );

  return {
    ...state,
    connected,
    festivalModeEnabled,
    lastEvent,
    refresh: () => load(true),
  };
}
