import type { Announcement, AnnouncementCategory } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useRealtime } from '../../../realtime/realtime-provider';
import { listAnnouncements, markAnnouncementRead } from '../api/owner-announcements-api';

export function useOwnerAnnouncements(activeCategory: AnnouncementCategory | null = null) {
  const realtime = useRealtime();
  const { isOffline } = useConnectivity();
  const [data, setData] = useState<Announcement[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (refreshing = false) => {
      setErrorMessage(null);
      setIsLoading(!refreshing && data.length === 0);
      setIsRefreshing(refreshing);

      if (isOffline) {
        setErrorMessage('Connect to the internet to load announcements.');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        const result = await listAnnouncements({
          category: activeCategory ?? undefined,
          limit: 30,
          page: 1,
        });
        setData(result.items);
      } catch {
        setErrorMessage('We could not load announcements right now.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeCategory, data.length, isOffline],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (realtime.lastEvent?.name === 'announcement:new') {
      void load(true);
    }
  }, [load, realtime.lastEvent]);

  const emergencyAnnouncement = useMemo(
    () =>
      data.find(
        (announcement) =>
          announcement.category === 'EMERGENCY' || announcement.priority === 'CRITICAL',
      ) ?? null,
    [data],
  );

  return {
    data,
    emergencyAnnouncement,
    errorMessage,
    isLoading,
    isRefreshing,
    markRead: async (announcementId: string) => {
      if (isOffline) {
        setErrorMessage('Connect to the internet to mark announcements read.');
        return;
      }

      await markAnnouncementRead(announcementId).catch(() => undefined);
      await load(true);
    },
    refresh: () => load(true),
  };
}
