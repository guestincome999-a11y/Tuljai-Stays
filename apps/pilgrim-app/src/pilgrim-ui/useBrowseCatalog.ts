import { useCallback, useEffect, useRef, useState } from 'react';

import { apiClient } from '../api/client';
import type { CatalogPage, CatalogQuery } from '../v2/core/catalog';

import { toSummaryLodge } from './backend-sync';
import { usePilgrimApp } from './PilgrimAppProvider';

/** Server-side filters and pagination: only the requested page is downloaded. */
export function useBrowseCatalog(query: CatalogQuery, disabled = false) {
  const { cacheLodgeSummaries, catalogRevision, ensureLodgesHydrated, lodges } = usePilgrimApp();
  const key = JSON.stringify(query);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const nextPage = useRef(1);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const load = useCallback(
    async (page: number, version: number) => {
      if (generation.current !== version) return;
      if (disabled) {
        setIds([]);
        setLoading(false);
        setHasMore(false);
        setTotal(0);
        return;
      }
      inFlight.current = true;
      setLoading(true);
      setError(false);
      try {
        const filters = JSON.parse(key) as CatalogQuery;
        const response = await apiClient.get<CatalogPage>('/catalog/lodges', {
          params: {
            ...filters,
            amenities: filters.amenities?.join(','),
            ids: filters.ids?.join(','),
            page,
            pageSize: 6,
          },
        });
        if (generation.current !== version) return;
        cacheLodgeSummaries(response.items.map(toSummaryLodge));
        setIds((current) =>
          page === 1
            ? response.items.map((item) => item.id)
            : [...new Set([...current, ...response.items.map((item) => item.id)])],
        );
        setHasMore(page < response.totalPages);
        setTotal(response.totalItems);
        nextPage.current = page + 1;
      } catch {
        if (generation.current === version) setError(true);
      } finally {
        if (generation.current === version) {
          inFlight.current = false;
          setLoading(false);
        }
      }
    },
    [cacheLodgeSummaries, disabled, key],
  );

  useEffect(() => {
    const version = ++generation.current;
    setIds([]);
    setError(false);
    setHasMore(false);
    setTotal(0);
    inFlight.current = true;
    setLoading(true);
    nextPage.current = 1;
    const timer = setTimeout(() => void load(1, version), 300);
    return () => {
      clearTimeout(timer);
      generation.current += 1;
    };
  }, [load, catalogRevision]);
  const visibleKey = ids.join('|');
  useEffect(() => {
    if (visibleKey) ensureLodgesHydrated(visibleKey.split('|'));
  }, [ensureLodgesHydrated, visibleKey]);
  return {
    items: ids.flatMap((id) => {
      const lodge = lodges.find((item) => item.id === id);
      return lodge ? [lodge] : [];
    }),
    loading,
    error,
    hasMore,
    total,
    refresh: () => {
      const version = ++generation.current;
      nextPage.current = 1;
      void load(1, version);
    },
    loadMore: () => {
      if (!inFlight.current && hasMore) void load(nextPage.current, generation.current);
    },
  };
}
