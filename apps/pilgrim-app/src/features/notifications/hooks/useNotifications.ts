import type { Notification } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { useRealtime } from '../../../realtime/realtime-provider';
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications-api';

export function useUnreadNotificationCount() {
  const realtime = useRealtime();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    const result = await getUnreadNotificationCount().catch(() => ({ unreadCount: 0 }));
    setUnreadCount(result.unreadCount);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const event = realtime.lastEvent;

    if (event?.name === 'notification:unread-count') {
      const nextCount = event.payload.unreadCount;

      if (typeof nextCount === 'number') {
        setUnreadCount(nextCount);
      }

      return;
    }

    if (event?.name === 'notification:new') {
      void refresh();
    }
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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (realtime.lastEvent?.name === 'notification:new') {
      void load(true);
    }
  }, [load, realtime.lastEvent]);

  return {
    data,
    errorMessage,
    isLoading,
    isRefreshing,
    markAllRead: async () => {
      await markAllNotificationsRead().catch(() => undefined);
      await load(true);
    },
    markRead: async (notificationId: string) => {
      await markNotificationRead(notificationId).catch(() => undefined);
      await load(true);
    },
    refresh: () => load(true),
  };
}
