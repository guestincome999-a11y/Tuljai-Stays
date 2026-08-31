'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  getUserDirectoryDetail,
  updateUserDirectoryStatus,
  type UserDirectoryDetail,
} from '../api/admin-user-directory-api';

interface AdminUserDirectoryDetailState {
  data: UserDirectoryDetail | null;
  errorMessage: string | null;
  isLoading: boolean;
}

export function useAdminUserDirectoryDetail(userId: string) {
  const [state, setState] = useState<AdminUserDirectoryDetailState>({
    data: null,
    errorMessage: null,
    isLoading: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, errorMessage: null, isLoading: !current.data }));
    try {
      const detail = await getUserDirectoryDetail(userId);
      setState({ data: detail, errorMessage: null, isLoading: false });
    } catch {
      setState((current) => ({
        ...current,
        errorMessage: 'User detail could not be loaded.',
        isLoading: false,
      }));
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setActiveStatus = useCallback(
    async (isActive: boolean, reason: string) => {
      setIsSubmitting(true);
      setActionError(null);
      try {
        await updateUserDirectoryStatus(userId, { isActive, reason });
        await load();
        return true;
      } catch {
        setActionError('The account status could not be updated. Backend validation prevented this action.');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [load, userId],
  );

  return {
    ...state,
    actionError,
    isSubmitting,
    refresh: load,
    setActiveStatus,
  };
}
