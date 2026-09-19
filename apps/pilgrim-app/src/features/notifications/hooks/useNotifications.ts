import type { Notification } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { useRealtime } from '../../../realtime/realtime-provider';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications-api';
import {
  getNotificationUnreadCount,
  refreshNotificationUnreadCount,
  setNotificationUnreadCount,
  subscribeNotificationUnreadCount,
} from '../notification-count-store';

// The OS app-icon badge is written from exactly one place
// (`PilgrimAppProvider`, mirroring the shared unread-count store). Hooks here
// only update the store, so two writers can never leave the icon on a stale
// number.
export function useUnreadNotificationCount() {
  const realtime = useRealtime();
  const [unreadCount, setUnreadCount] = useState(getNotificationUnreadCount());

  useEffect(() => subscribeNotificationUnreadCount(setUnreadCount), []);

  const refresh = useCallback(() => refreshNotificationUnreadCount(), []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const event = realtime.lastEvent;

    if (event?.name === 'notification:unread-count') {
      const nextCount = event.payload.unreadCount;
      if (typeof nextCount === 'number') setNotificationUnreadCount(nextCount);
      return;
    }

    if (event?.name === 'notification:new') void refresh();
  }, [realtime.lastEvent, refresh]);

  return { refresh, unreadCount };
}

export function useNotifications() {
  const realtime = useRealtime();
  const [data, setData] = useState<Notification[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (refreshing = false) => {
    setErrorMessage(null);
    setIsLoading(!refreshing);
    setIsRefreshing(refreshing);

    try {
      const result = await listNotifications();
      setData(result.items);
    } catch {
      setErrorMessage('We could not load notifications right now.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refreshUnreadCount = useCallback(() => refreshNotificationUnreadCount(), []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (realtime.lastEvent?.name === 'notification:new') void load(true);
  }, [load, realtime.lastEvent]);

  const markAllRead = useCallback(async () => {
    setErrorMessage(null);
    try {
      await markAllNotificationsRead();
      setNotificationUnreadCount(0);
      await load(true);
      await refreshUnreadCount();
    } catch {
      setErrorMessage('Notification action failed. Please try again.');
      await refreshUnreadCount();
    }
  }, [load, refreshUnreadCount]);

  const markRead = useCallback(
    async (notificationId: string) => {
      setErrorMessage(null);
      try {
        await markNotificationRead(notificationId);
        await load(true);
        await refreshUnreadCount();
      } catch {
        setErrorMessage('Notification action failed. Please try again.');
        await refreshUnreadCount();
      }
    },
    [load, refreshUnreadCount],
  );

  return {
    data,
    errorMessage,
    isLoading,
    isRefreshing,
    markAllRead,
    markRead,
    refresh: () => load(true),
  };
}
