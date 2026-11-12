import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { fetchCatalog } from './catalog';
import type { CatalogLodgeCard, CatalogPage, CatalogQuery } from './catalog';
import { subscribeCatalogChanges } from './catalog-sync';
import { registerCachedRefresher } from './useCachedFetch';

const PAGE_SIZE = 12;
const firstPageCache = new Map<string, CatalogPage>();

export type CatalogListQuery = Omit<CatalogQuery, 'page' | 'pageSize'>;

interface ListState {
  error: boolean;
  items: CatalogLodgeCard[];
  loading: boolean;
  loadingMore: boolean;
  page: number;
  totalItems: number;
  totalPages: number;
}

function stateFromPage(page: CatalogPage): ListState {
  return {
    error: false,
    items: page.items,
    loading: false,
    loadingMore: false,
    page: page.page,
    totalItems: page.totalItems,
    totalPages: page.totalPages,
  };
}

const EMPTY_STATE: ListState = {
  error: false,
  items: [],
  loading: true,
  loadingMore: false,
  page: 0,
  totalItems: 0,
  totalPages: 0,
};

/**
 * Paged lodge results for a set of filters. The first page for any filter combination is
 * remembered, so going back to a search shows results instantly while a fresh copy loads.
 */
export function useCatalogList(query: CatalogListQuery) {
  const key = JSON.stringify(query);
  const [state, setState] = useState<ListState>(() => {
    const cached = firstPageCache.get(key);
    return cached ? stateFromPage(cached) : EMPTY_STATE;
  });
  const requestId = useRef(0);
  const activeRequest = useRef<{ key: string; request: Promise<void> } | null>(null);
  const loadingNext = useRef(false);
  const queryRef = useRef(query);
  queryRef.current = query;

  const loadFirstPage = useCallback((): Promise<void> => {
    if (activeRequest.current?.key === key) return activeRequest.current.request;
    const request = (async () => {
      const id = ++requestId.current;
      try {
        const page = await fetchCatalog({ ...queryRef.current, page: 1, pageSize: PAGE_SIZE });
        if (id !== requestId.current) return;
        if (firstPageCache.size >= 20) firstPageCache.delete(firstPageCache.keys().next().value!);
        firstPageCache.set(key, page);
        setState(stateFromPage(page));
      } catch {
        if (id === requestId.current)
          setState((current) => ({ ...current, error: true, loading: false }));
      }
    })().finally(() => {
      if (activeRequest.current?.request === request) activeRequest.current = null;
    });
    activeRequest.current = { key, request };
    return request;
  }, [key]);

  useEffect(() => {
    const cached = firstPageCache.get(key);
    setState(cached ? stateFromPage(cached) : EMPTY_STATE);
    void loadFirstPage();
    const unregister = registerCachedRefresher(loadFirstPage);
    const unsubscribe = subscribeCatalogChanges((change) => {
      firstPageCache.clear();
      requestId.current++;
      activeRequest.current = null;
      if (change.lodgeId && change.isActive === false)
        setState((current) => ({
          ...current,
          items: current.items.filter((lodge) => lodge.id !== change.lodgeId),
        }));
    });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadFirstPage();
    });
    // Also covers unauthenticated browsing, where no role-authenticated socket exists.
    const fallback = setInterval(() => {
      if (AppState.currentState === 'active') void loadFirstPage();
    }, 60000);
    return () => {
      unregister();
      unsubscribe();
      foreground.remove();
      clearInterval(fallback);
      requestId.current++;
      activeRequest.current = null;
    };
  }, [key, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (loadingNext.current || state.loading || state.loadingMore || state.page >= state.totalPages)
      return;
    loadingNext.current = true;
    const id = requestId.current;
    setState((current) => ({ ...current, loadingMore: true }));
    try {
      const next = await fetchCatalog({
        ...queryRef.current,
        page: state.page + 1,
        pageSize: PAGE_SIZE,
      });
      if (id !== requestId.current) return;
      setState((current) => {
        const known = new Set(current.items.map((item) => item.id));
        return {
          ...current,
          items: [...current.items, ...next.items.filter((item) => !known.has(item.id))],
          loadingMore: false,
          page: next.page,
          totalItems: next.totalItems,
          totalPages: next.totalPages,
        };
      });
    } catch {
      if (id === requestId.current)
        setState((current) => ({ ...current, error: true, loadingMore: false }));
    } finally {
      loadingNext.current = false;
    }
  }, [state.loading, state.loadingMore, state.page, state.totalPages]);

  return { ...state, loadMore, refresh: loadFirstPage };
}
