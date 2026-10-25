import { useCallback, useEffect, useState } from 'react';

import {
  getLodgeDetailsView,
  listAmenities,
  loadHomeDiscoverySnapshot,
  searchLodgePreviews,
} from '../api/lodge-discovery-api';
import type {
  HomeDiscoverySnapshot,
  LodgeDetailsView,
  LodgeFilters,
  LodgePreview,
  LodgeSearchQuery,
} from '../types/lodge-discovery';

const DEFAULT_PAGE_SIZE = 8;

export const defaultLodgeFilters: LodgeFilters = {
  amenitySlugs: [],
  sort: 'distance',
};

interface AsyncState<TData> {
  data: TData | null;
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export function useHomeDiscovery() {
  const [state, setState] = useState<AsyncState<HomeDiscoverySnapshot>>({
    data: null,
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
  });

  const load = useCallback(async (refreshing = false) => {
    setState((current) => ({
      ...current,
      errorMessage: null,
      isLoading: !refreshing && !current.data,
      isRefreshing: refreshing,
    }));

    try {
      const data = await loadHomeDiscoverySnapshot();
      setState({ data, errorMessage: null, isLoading: false, isRefreshing: false });
    } catch {
      setState((current) => ({
        ...current,
        errorMessage: 'We could not load lodges right now. Please try again.',
        isLoading: false,
        isRefreshing: false,
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    ...state,
    refresh: () => load(true),
  };
}

export function useLodgeList(initialFilters: Partial<LodgeFilters> = {}, initialSearch = '') {
  const [amenities, setAmenities] = useState<Awaited<ReturnType<typeof listAmenities>>>([]);
  const [filters, setFilters] = useState<LodgeFilters>({
    ...defaultLodgeFilters,
    ...initialFilters,
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialSearch);
  const [state, setState] = useState<AsyncState<LodgePreview[]> & { totalPages: number }>({
    data: [],
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
    totalPages: 1,
  });

  const load = useCallback(
    async (nextPage: number, mode: 'replace' | 'append' | 'refresh') => {
      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: mode === 'replace' && (current.data?.length ?? 0) === 0,
        isRefreshing: mode === 'refresh',
      }));
      setIsLoadingMore(mode === 'append');

      try {
        const query: LodgeSearchQuery = {
          ...filters,
          page: nextPage,
          pageSize: DEFAULT_PAGE_SIZE,
          search: search.trim() || undefined,
        };
        const response = await searchLodgePreviews(query);
        setState((current) => ({
          data: mode === 'append' ? [...(current.data ?? []), ...response.items] : response.items,
          errorMessage: null,
          isLoading: false,
          isRefreshing: false,
          totalPages: Math.max(response.totalPages, 1),
        }));
        setPage(nextPage);
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'We could not load lodges right now. Please try again.',
          isLoading: false,
          isRefreshing: false,
        }));
      } finally {
        setIsLoadingMore(false);
      }
    },
    [filters, search],
  );

  useEffect(() => {
    let mounted = true;

    async function loadAmenities() {
      const nextAmenities = await listAmenities().catch(() => []);

      if (mounted) {
        setAmenities(nextAmenities);
      }
    }

    void loadAmenities();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void load(1, 'replace');
  }, [filters, load, search]);

  const canLoadMore = page < state.totalPages && !state.isLoading && !isLoadingMore;

  return {
    amenities,
    canLoadMore,
    data: state.data ?? [],
    errorMessage: state.errorMessage,
    filters,
    isLoading: state.isLoading,
    isLoadingMore,
    isRefreshing: state.isRefreshing,
    loadMore: () => {
      if (canLoadMore) {
        void load(page + 1, 'append');
      }
    },
    refresh: () => load(1, 'refresh'),
    search,
    setFilters,
    setSearch,
  };
}

export function useLodgeDetails(lodgeId: string | null) {
  const [state, setState] = useState<AsyncState<LodgeDetailsView>>({
    data: null,
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
  });

  const load = useCallback(
    async (refreshing = false) => {
      if (!lodgeId) {
        setState({
          data: null,
          errorMessage: 'This lodge could not be opened.',
          isLoading: false,
          isRefreshing: false,
        });
        return;
      }

      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && !current.data,
        isRefreshing: refreshing,
      }));

      try {
        const data = await getLodgeDetailsView(lodgeId);
        setState({ data, errorMessage: null, isLoading: false, isRefreshing: false });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'We could not load this lodge right now.',
          isLoading: false,
          isRefreshing: false,
        }));
      }
    },
    [lodgeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    ...state,
    refresh: () => load(true),
  };
}
