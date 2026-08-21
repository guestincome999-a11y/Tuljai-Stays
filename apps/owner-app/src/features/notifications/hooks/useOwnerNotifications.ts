import type { Notification, NotificationType } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { syncOwnerNotificationBadge } from '../../../notifications/push-registration';
import { useRealtime } from '../../../realtime/realtime-provider';
import {
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/owner-notifications-api';
import { getNotificationUnreadCount, setNotificationUnreadCount, subscribeNotificationUnreadCount } from '../notification-count-store';
import { loadNotificationsCache, saveNotificationsCache } from '../storage/notifications-cache';

export function useUnreadNotificationCount() {
  const realtime = useRealtime();
  const { isOffline } = useConnectivity();
  const [unreadCount, setUnreadCount] = useState(getNotificationUnreadCount());

  useEffect(() => subscribeNotificationUnreadCount(setUnreadCount), []);

  const refresh = useCallback(async () => {
    if (isOffline) return;
    const result = await getUnreadNotificationCount().catch(() => ({ unreadCount: 0 }));
    setNotificationUnreadCount(result.unreadCount);
  }, [isOffline]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    void syncOwnerNotificationBadge(unreadCount);
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

  useEffect(() => {
    if (realtime.connectionRevision > 0) void refresh();
  }, [realtime.connectionRevision, refresh]);

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

  const load = useCallback(async (refreshing = false) => {
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
      const result = await listNotifications({ limit: 40, page: 1, type: activeType ?? undefined });
      setData(result.items);
      await saveNotificationsCache(result.items).catch(() => undefined);
    } catch {
      const cached = await loadNotificationsCache().catch(() => []);
      setData(cached);
      setErrorMessage(cached.length ? 'Showing last saved notifications. Refresh when online.' : 'We could not load notifications right now.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeType, data.length, isOffline]);

  const refreshUnreadCount = useCallback(async () => {
    if (isOffline) return;
    const result = await getUnreadNotificationCount().catch(() => ({ unreadCount: 0 }));
    setNotificationUnreadCount(result.unreadCount);
  }, [isOffline]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (realtime.lastEvent?.name === 'notification:new') void load(true);
  }, [load, realtime.lastEvent]);
  useEffect(() => {
    if (realtime.connectionRevision > 0) void load(true);
  }, [load, realtime.connectionRevision]);

  const runAction = useCallback(async (action: () => Promise<unknown>, markAll = false) => {
    if (isOffline) {
      setErrorMessage('Connect to the internet to complete this action.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await action();
      if (markAll) setNotificationUnreadCount(0);
      await load(true);
      await refreshUnreadCount();
    } catch {
      setErrorMessage('Notification action failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isOffline, load, refreshUnreadCount]);

  return {
    data,
    errorMessage,
    isLoading,
    isRefreshing,
    isSubmitting,
    markAllRead: () => runAction(markAllNotificationsRead, true),
    markRead: (notificationId: string) => runAction(() => markNotificationRead(notificationId)),
    refresh: () => load(true),
    remove: (notificationId: string) => runAction(() => deleteNotification(notificationId)),
  };
}
