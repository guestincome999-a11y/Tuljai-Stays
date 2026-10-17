import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchCatalog } from './catalog';
import type { CatalogLodgeCard, CatalogPage, CatalogQuery } from './catalog';

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
  const queryRef = useRef(query);
  queryRef.current = query;

  const loadFirstPage = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const page = await fetchCatalog({ ...queryRef.current, page: 1, pageSize: PAGE_SIZE });
      if (id !== requestId.current) return;
      firstPageCache.set(key, page);
      setState(stateFromPage(page));
    } catch {
      if (id === requestId.current)
        setState((current) => ({ ...current, error: true, loading: false }));
    }
  }, [key]);

  useEffect(() => {
    const cached = firstPageCache.get(key);
    setState(cached ? stateFromPage(cached) : EMPTY_STATE);
    void loadFirstPage();
  }, [key, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (state.loading || state.loadingMore || state.page >= state.totalPages) return;
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
      if (id === requestId.current) setState((current) => ({ ...current, loadingMore: false }));
    }
  }, [state.loading, state.loadingMore, state.page, state.totalPages]);

  return { ...state, loadMore, refresh: loadFirstPage };
}
