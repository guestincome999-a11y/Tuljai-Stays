import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchCatalog } from './catalog';
import type { CatalogLodgeCard, CatalogPage, CatalogQuery } from './catalog';
import { catalogErrorKind } from './catalog-request';

const PAGE_SIZE = 12;
const firstPageCache = new Map<string, { page: CatalogPage; expires: number }>();
function cachedPage(key: string): CatalogPage | undefined {
  const entry = firstPageCache.get(key);
  if (entry && entry.expires > Date.now()) return entry.page;
  firstPageCache.delete(key);
  return undefined;
}

export type CatalogListQuery = Omit<CatalogQuery, 'page' | 'pageSize'>;

interface ListState {
  error: boolean;
  errorKind?: 'network' | 'server' | 'request';
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
    const cached = cachedPage(key);
    return cached ? stateFromPage(cached) : EMPTY_STATE;
  });
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const paging = useRef(false);
  const queryRef = useRef(query);
  queryRef.current = query;

  const loadFirstPage = useCallback(async () => {
    const id = ++requestId.current;
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    paging.current = false;
    setState((current) => ({
      ...current,
      error: false,
      errorKind: undefined,
      loading: true,
      loadingMore: false,
    }));
    try {
      const page = await fetchCatalog(
        { ...queryRef.current, page: 1, pageSize: PAGE_SIZE },
        active.signal,
      );
      if (id !== requestId.current) return;
      firstPageCache.delete(key);
      firstPageCache.set(key, { page, expires: Date.now() + 15_000 });
      if (firstPageCache.size > 20) firstPageCache.delete(firstPageCache.keys().next().value!);
      setState(stateFromPage(page));
    } catch (error) {
      if (id === requestId.current)
        setState((current) => ({
          ...current,
          error: true,
          errorKind: catalogErrorKind(error),
          loading: false,
        }));
    }
  }, [key]);

  useEffect(() => {
    const cached = cachedPage(key);
    setState(cached ? stateFromPage(cached) : EMPTY_STATE);
    void loadFirstPage();
    return () => {
      requestId.current += 1;
      controller.current?.abort();
      paging.current = false;
    };
  }, [key, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (
      paging.current ||
      state.error ||
      state.loading ||
      state.loadingMore ||
      state.page >= state.totalPages
    )
      return;
    const id = requestId.current;
    paging.current = true;
    setState((current) => ({ ...current, loadingMore: true, error: false }));
    try {
      const next = await fetchCatalog(
        {
          ...queryRef.current,
          page: state.page + 1,
          pageSize: PAGE_SIZE,
        },
        controller.current?.signal,
      );
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
    } catch (error) {
      if (id === requestId.current)
        setState((current) => ({
          ...current,
          loadingMore: false,
          error: true,
          errorKind: catalogErrorKind(error),
        }));
    } finally {
      if (id === requestId.current) paging.current = false;
    }
  }, [state.error, state.loading, state.loadingMore, state.page, state.totalPages]);

  return { ...state, loadMore, refresh: loadFirstPage };
}
