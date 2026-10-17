import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const cache = new Map<string, unknown>();
const activeRefreshers = new Set<() => Promise<void>>();

/** Refreshes every fetch currently on screen. Used by pull-to-refresh. */
export async function refreshAllCached(): Promise<void> {
  await Promise.all([...activeRefreshers].map((refresh) => refresh()));
}

export interface CachedFetch<T> {
  data: T | undefined;
  error: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Shows the last result for `key` instantly, then refreshes it in the background. It also refreshes
 * whenever the app returns to the foreground, so prices an owner just changed are never stale.
 */
export function useCachedFetch<T>(key: string, fetcher: () => Promise<T>): CachedFetch<T> {
  const [data, setData] = useState<T | undefined>(() => cache.get(key) as T | undefined);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(data === undefined);
  const latest = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    const requestId = ++latest.current;
    try {
      const next = await fetcherRef.current();
      if (requestId !== latest.current) return;
      cache.set(key, next);
      setData(next);
      setError(false);
    } catch {
      if (requestId === latest.current) setError(true);
    } finally {
      if (requestId === latest.current) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    setData(cache.get(key) as T | undefined);
    activeRefreshers.add(refresh);
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      activeRefreshers.delete(refresh);
      subscription.remove();
    };
  }, [key, refresh]);

  return { data, error, loading, refresh };
}
