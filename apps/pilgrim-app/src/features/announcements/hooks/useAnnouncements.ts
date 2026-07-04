import type { Announcement } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { useRealtime } from '../../../realtime/realtime-provider';
import { listAnnouncements, markAnnouncementRead } from '../api/announcements-api';

export function useAnnouncements() {
  const realtime = useRealtime();
  const [data, setData] = useState<Announcement[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (refreshing = false) => {
    setErrorMessage(null);
    setIsLoading(!refreshing);
    setIsRefreshing(refreshing);

    try {
      const result = await listAnnouncements();
      setData(result.items);
    } catch {
      setErrorMessage('We could not load announcements right now.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (realtime.lastEvent?.name === 'announcement:new') {
      void load(true);
    }
  }, [load, realtime.lastEvent]);

  return {
    data,
    errorMessage,
    isLoading,
    isRefreshing,
    markRead: async (announcementId: string) => {
      await markAnnouncementRead(announcementId).catch(() => undefined);
      await load(true);
    },
    refresh: () => load(true),
  };
}
