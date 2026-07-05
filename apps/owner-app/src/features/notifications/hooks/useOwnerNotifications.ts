import type { Notification, NotificationType } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useRealtime } from '../../../realtime/realtime-provider';
import {
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/owner-notifications-api';
import { loadNotificationsCache, saveNotificationsCache } from '../storage/notifications-cache';

export function useUnreadNotificationCount() {
  const realtime = useRealtime();
  const { isOffline } = useConnectivity();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (isOffline) {
      return;
    }

    const result = await getUnreadNotificationCount().catch(() => ({ unreadCount: 0 }));
    setUnreadCount(result.unreadCount);
  }, [isOffline]);

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

export function useOwnerNotifications(activeType: NotificationType | null) {
  const realtime = useRealtime();
  const { isOffline } = useConnectivity();
  const [data, setData] = useState<Notification[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (refreshing = false) => {
      setErrorMessage(null);
      setIsLoading(!refreshing && data.length === 0);
      setIsRefreshing(refreshing);

      if (isOffline) {
        const cached = await loadNotificationsCache().catch(() => []);
        setData(cached);
        setErrorMessage(cached.length ? null : 'Connect to the internet to load notifications.');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        const result = await listNotifications({
          limit: 40,
          page: 1,
          type: activeType ?? undefined,
        });
        setData(result.items);
        await saveNotificationsCache(result.items).catch(() => undefined);
      } catch {
        const cached = await loadNotificationsCache().catch(() => []);
        setData(cached);
        setErrorMessage(
          cached.length
            ? 'Showing last saved notifications. Refresh when online.'
            : 'We could not load notifications right now.',
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeType, data.length, isOffline],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (realtime.lastEvent?.name === 'notification:new') {
      void load(true);
    }
  }, [load, realtime.lastEvent]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      if (isOffline) {
        setErrorMessage('Connect to the internet to update notifications.');
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        await action();
        await load(true);
      } catch {
        setErrorMessage('Notification action failed. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [isOffline, load],
  );

  return {
    data,
    errorMessage,
    isLoading,
    isRefreshing,
    isSubmitting,
    markAllRead: () => runAction(markAllNotificationsRead),
    markRead: (notificationId: string) => runAction(() => markNotificationRead(notificationId)),
    refresh: () => load(true),
    remove: (notificationId: string) => runAction(() => deleteNotification(notificationId)),
  };
}
