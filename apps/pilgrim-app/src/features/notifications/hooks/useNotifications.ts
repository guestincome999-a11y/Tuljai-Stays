import { useEffect, useSyncExternalStore } from 'react';

import { notificationState } from '../notification-count-store';

export function useUnreadNotificationCount() {
  const unreadCount = useSyncExternalStore(
    notificationState.subscribe,
    () => notificationState.getSnapshot().unreadCount,
  );
  return { unreadCount, refresh: notificationState.refresh };
}

export function useNotifications() {
  const state = useSyncExternalStore(notificationState.subscribe, notificationState.getSnapshot);
  useEffect(() => {
    void notificationState.setType();
  }, []);
  return {
    data: state.items,
    errorMessage: state.error ?? (state.pendingCount ? 'Read changes are waiting to sync.' : null),
    isLoading: state.loading && state.items.length === 0,
    isRefreshing: state.loading,
    isSubmitting: false,
    unreadCount: state.unreadCount,
    markAllRead: notificationState.markAllRead,
    markRead: notificationState.markRead,
    refresh: notificationState.refresh,
  };
}
