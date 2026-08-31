'use client';

import type { PaginatedResponse } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import {
  getUserDirectoryStats,
  listUserDirectory,
  type UserDirectoryListParams,
  type UserDirectoryStats,
  type UserDirectorySummary,
} from '../api/admin-user-directory-api';

interface AdminUserDirectoryState {
  data: PaginatedResponse<UserDirectorySummary> | null;
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export interface AdminUserDirectoryFilters {
  q: string;
  role: UserDirectoryListParams['role'] | '';
  status: UserDirectoryListParams['status'] | '';
}

export function useAdminUserDirectory(filters: AdminUserDirectoryFilters, page: number) {
  const [state, setState] = useState<AdminUserDirectoryState>({
    data: null,
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
  });
  const [stats, setStats] = useState<UserDirectoryStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const load = useCallback(
    async (refreshing = false) => {
      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && !current.data,
        isRefreshing: refreshing,
      }));

      try {
        const response = await listUserDirectory({
          limit: 20,
          page,
          q: filters.q.trim() || undefined,
          role: filters.role || undefined,
          status: filters.status || undefined,
        });
        setState({ data: response, errorMessage: null, isLoading: false, isRefreshing: false });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Users could not be loaded. Please retry.',
          isLoading: false,
          isRefreshing: false,
        }));
      }
    },
    [filters.q, filters.role, filters.status, page],
  );

  const loadStats = useCallback(async () => {
    setStatsError(null);
    try {
      setStats(await getUserDirectoryStats());
    } catch {
      setStatsError('User stats could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return {
    ...state,
    refresh: () => {
      void load(true);
      void loadStats();
    },
    stats,
    statsError,
  };
}
