import type { NotificationType } from '@tuljai/types';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { deleteNotification } from '../api/owner-notifications-api';
import { notificationState } from '../notification-count-store';

export function useUnreadNotificationCount() {
  const unreadCount = useSyncExternalStore(
    notificationState.subscribe,
    () => notificationState.getSnapshot().unreadCount,
  );
  return { unreadCount, refresh: notificationState.refresh };
}

export function useOwnerNotifications(activeType: NotificationType | null) {
  const [actionError, setActionError] = useState<string | null>(null);
  const state = useSyncExternalStore(notificationState.subscribe, notificationState.getSnapshot);
  useEffect(() => {
    void notificationState.setType(activeType ?? undefined);
  }, [activeType]);
  return {
    data: activeType ? state.items.filter((item) => item.type === activeType) : state.items,
    errorMessage:
      actionError ??
      state.error ??
      (state.pendingCount ? 'Read changes are waiting to sync.' : null),
    isLoading: state.loading && state.items.length === 0,
    isRefreshing: state.loading,
    isSubmitting: false,
    unreadCount: state.unreadCount,
    markAllRead: notificationState.markAllRead,
    markRead: notificationState.markRead,
    refresh: notificationState.refresh,
    remove: async (id: string) => {
      setActionError(null);
      try {
        await deleteNotification(id);
        await notificationState.refresh();
      } catch {
        setActionError('Could not delete this notification. Please try again when connected.');
      }
    },
  };
}
