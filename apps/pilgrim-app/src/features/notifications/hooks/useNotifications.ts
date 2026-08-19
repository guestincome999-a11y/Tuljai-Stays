import type { Notification } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { syncPilgrimNotificationBadge } from '../../../notifications/push-registration';
import { useRealtime } from '../../../realtime/realtime-provider';
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications-api';
import {
  getNotificationUnreadCount,
  setNotificationUnreadCount,
  subscribeNotificationUnreadCount,
} from '../notification-count-store';

export function useUnreadNotificationCount() {
  const realtime = useRealtime();
  const [unreadCount, setUnreadCount] = useState(getNotificationUnreadCount());

  useEffect(() => subscribeNotificationUnreadCount(setUnreadCount), []);

  const refresh = useCallback(async () => {
    const result = await getUnreadNotificationCount().catch(() => ({ unreadCount: 0 }));
    setNotificationUnreadCount(result.unreadCount);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void syncPilgrimNotificationBadge(unreadCount);
  }, [unreadCount]);

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

  const refreshUnreadCount = useCallback(async () => {
    const result = await getUnreadNotificationCount().catch(() => ({ unreadCount: 0 }));
    setNotificationUnreadCount(result.unreadCount);
  }, []);

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

  const markRead = useCallback(async (notificationId: string) => {
    setErrorMessage(null);
    try {
      await markNotificationRead(notificationId);
      await load(true);
      await refreshUnreadCount();
    } catch {
      setErrorMessage('Notification action failed. Please try again.');
      await refreshUnreadCount();
    }
  }, [load, refreshUnreadCount]);

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
