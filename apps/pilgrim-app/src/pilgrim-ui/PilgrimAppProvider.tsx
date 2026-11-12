import type { BookingGuestIdProofUpload } from '@tuljai/types';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/auth-context';
import {
  cancelBooking as cancelBackendBooking,
  createBooking as createBackendBooking,
  createBookingLock,
  getBookingRecord,
} from '../features/bookings/api/bookings-api';
import { invalidateLodgeCatalogCache } from '../features/lodges/api/lodge-discovery-api';
import {
  getNotificationUnreadCount,
  notificationState,
  subscribeNotificationUnreadCount,
} from '../features/notifications/notification-count-store';
import { getEventBookingId } from '../realtime/realtime-events';
import { useRealtime } from '../realtime/realtime-provider';

import {
  applyBackendBookingRecord,
  getFallbackNotifications,
  hydrateBackendLodge,
  loadBackendBookings,
  mapNotification,
  loadLodgeSummaries,
  mapBooking,
  synthesizeEnrichedBooking,
} from './backend-sync';
import { applyRealtimeBookingEvent, mergeBackendBookingSnapshot } from './booking-state';
import {
  initialPilgrimBookings,
  pilgrimLodges,
  type PilgrimBooking,
  type PilgrimLodge,
  type PilgrimNotification,
} from './mock-data';
import {
  defaultPilgrimPreferences,
  loadPilgrimPreferences,
  savePilgrimPreferences,
} from './pilgrim-preferences-store';

export type PilgrimLanguage = 'en' | 'mr';

// When the app returns to the foreground, lodge prices and content are
// re-fetched if the last load is older than this, so edits made in the admin
// panel while the app was in the background show up without a restart.
const LODGE_FOREGROUND_REFRESH_MS = 30_000;

interface CreateBookingInput {
  checkInDate: string;
  checkOutDate: string;
  checkoutDateFlexible: boolean;
  guestEmail?: string;
  // Already uploaded to the backend by the checkout screen at pick time, so
  // booking creation doesn't have to wait on a multipart upload round-trip.
  guestIdProof: BookingGuestIdProofUpload;
  guestName: string;
  guestPhone: string;
  lodgeId: string;
  numberOfAdults: number;
  numberOfChildren: number;
  paymentMethod: 'ONLINE' | 'PAY_AT_LODGE';
  roomId: string;
  specialRequest?: string;
}

interface PilgrimAppContextValue {
  cacheLodgeSummaries: (items: PilgrimLodge[]) => void;
  catalogRevision: number;
  bookingNotificationsEnabled: boolean;
  bookings: PilgrimBooking[];
  cancelBooking: (id: string, reason?: string) => Promise<void>;
  createBooking: (input: CreateBookingInput) => Promise<PilgrimBooking>;
  /**
   * Requests full details (photos, room prices) for the given lodge ids.
   * Only lodges not already hydrated or already in flight are fetched, so
   * it's safe to call repeatedly (e.g. every time the visible list changes)
   * without triggering duplicate requests. This is what keeps detail calls
   * scoped to what's actually on screen instead of the whole catalog.
   */
  ensureLodgesHydrated: (lodgeIds: string[]) => void;
  favoriteIds: string[];
  isBackendConnected: boolean;
  isSyncing: boolean;
  language: PilgrimLanguage;
  lodges: PilgrimLodge[];
  markNotificationsRead: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  notifications: PilgrimNotification[];
  refresh: () => Promise<void>;
  setBookingNotificationsEnabled: (enabled: boolean) => void;
  setLanguage: (language: PilgrimLanguage) => void;
  syncError: string | null;
  t: (english: string, marathi: string) => string;
  toggleFavorite: (lodgeId: string) => void;
  /** Server-side unread count (all pages) — the single source for the bell and OS badge. */
  unreadCount: number;
}

const PilgrimAppContext = createContext<PilgrimAppContextValue | null>(null);

export function PilgrimAppProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const realtime = useRealtime();
  const mockMode = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
  const [language, setLanguage] = useState<PilgrimLanguage>(defaultPilgrimPreferences.language);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(defaultPilgrimPreferences.favoriteIds);
  const [bookingNotificationsEnabled, setBookingNotificationsEnabled] = useState(
    defaultPilgrimPreferences.bookingNotificationsEnabled,
  );
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [loadedPreferencesUserId, setLoadedPreferencesUserId] = useState<string | null>(null);
  const [lodges, setLodges] = useState<PilgrimLodge[]>(pilgrimLodges);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const cacheLodgeSummaries = useCallback((items: PilgrimLodge[]) => {
    setLodges((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      for (const item of items) {
        const previous = byId.get(item.id);
        byId.set(
          item.id,
          previous?.hydrated && !item.hydrated
            ? {
                ...previous,
                price: item.price,
                priceAvailable: item.priceAvailable,
                rating: item.rating,
                reviewCount: item.reviewCount,
              }
            : item,
        );
      }
      return [...byId.values()];
    });
  }, []);
  const [bookings, setBookings] = useState<PilgrimBooking[]>(
    mockMode ? initialPilgrimBookings : [],
  );
  const notificationItems = useSyncExternalStore(
    notificationState.subscribe,
    () => notificationState.getSnapshot().items,
  );
  const notifications = useMemo(
    () => (mockMode ? getFallbackNotifications() : notificationItems.map(mapNotification)),
    [mockMode, notificationItems],
  );
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(getNotificationUnreadCount());
  const privateDataVersionRef = useRef(0);

  // Tracks lodge ids currently being hydrated so ensureLodgesHydrated can be
  // called repeatedly (e.g. from a scroll handler) without firing duplicate
  // detail requests for the same lodge.
  const hydratingIdsRef = useRef<Set<string>>(new Set());

  // Latest lodges list for async code (catalog reloads) that must read what is
  // currently on screen without re-creating its callback on every change.
  const lodgesRef = useRef<PilgrimLodge[]>(lodges);
  useEffect(() => {
    lodgesRef.current = lodges;
  }, [lodges]);

  // Bumped on every catalog reload so only the newest reload may write its
  // refreshed lodge details back into state (a slow older one is discarded).
  const lodgeLoadVersionRef = useRef(0);
  const lastLodgeLoadAtRef = useRef(0);

  const ensureLodgesHydrated = useCallback((lodgeIds: string[]) => {
    if (lodgeIds.length === 0) return;
    setLodges((current) => {
      const byId = new Map(current.map((lodge) => [lodge.id, lodge]));
      const toHydrate = lodgeIds
        .map((id) => byId.get(id))
        .filter(
          (lodge): lodge is PilgrimLodge =>
            !!lodge && lodge.hydrated === false && !hydratingIdsRef.current.has(lodge.id),
        );
      toHydrate.forEach((lodge) => {
        hydratingIdsRef.current.add(lodge.id);
        const revision = lodgeLoadVersionRef.current;
        void hydrateBackendLodge(lodge)
          .then((hydratedLodge) => {
            if (revision !== lodgeLoadVersionRef.current) return;
            setLodges((prev) =>
              prev.map((item) => (item.id === hydratedLodge.id ? hydratedLodge : item)),
            );
          })
          .catch(() => undefined)
          .finally(() => {
            hydratingIdsRef.current.delete(lodge.id);
          });
      });
      // This call only kicks off requests; the actual state update happens
      // asynchronously above, so return the same reference to avoid an
      // extra render here.
      return current;
    });
  }, []);

  const pendingLodgeLoad = useRef<Promise<PilgrimLodge[]> | null>(null);
  const loadLodges = useCallback((): Promise<PilgrimLodge[]> => {
    if (pendingLodgeLoad.current) return pendingLodgeLoad.current;
    const request = (async () => {
      // Drop every cached lodge/photo/room-type response first, so prices and
      // content edited in the admin panel are fetched fresh from the backend
      // instead of being served from the in-memory cache.
      invalidateLodgeCatalogCache();
      const loadVersion = ++lodgeLoadVersionRef.current;
      const summaries = await loadLodgeSummaries();
      if (loadVersion !== lodgeLoadVersionRef.current) return summaries;

      // Lodges whose full details are already on screen keep them while fresh
      // details load below, so a catalog refresh never flashes back to empty
      // skeleton cards (and ensureLodgesHydrated, which only re-runs when the
      // visible ids change, never has to rescue them).
      const previousById = new Map(lodgesRef.current.map((lodge) => [lodge.id, lodge]));
      const toRefresh: PilgrimLodge[] = [];
      const merged = summaries.map((summary) => {
        const previous = previousById.get(summary.id);
        if (previous?.hydrated && summary.hydrated === false) {
          toRefresh.push(previous);
          return previous;
        }
        return summary;
      });

      lastLodgeLoadAtRef.current = Date.now();
      setLodges(merged);
      setCatalogRevision((value) => value + 1);
      hydratingIdsRef.current.clear();
      setFavoriteIds((current) =>
        current.map((favoriteId) => {
          const matchingLodge = summaries.find(
            (lodge) => lodge.id === favoriteId || lodge.slug === favoriteId,
          );
          return matchingLodge?.id ?? favoriteId;
        }),
      );

      // Re-fetch full details (price, rooms, photos, content) for every lodge
      // that was already hydrated and swap the fresh copy in place. If a
      // request fails, hydrateBackendLodge hands back the previous copy
      // unchanged.
      toRefresh.forEach((previous) => {
        void hydrateBackendLodge(previous)
          .then((fresh) => {
            if (loadVersion !== lodgeLoadVersionRef.current) return;
            setLodges((current) => current.map((item) => (item.id === fresh.id ? fresh : item)));
          })
          .catch(() => undefined);
      });

      return summaries;
    })().finally(() => {
      if (pendingLodgeLoad.current === request) pendingLodgeLoad.current = null;
    });
    pendingLodgeLoad.current = request;
    return request;
  }, []);

  const loadPrivateData = useCallback(
    async (availableLodges: PilgrimLodge[]): Promise<PilgrimBooking[]> => {
      const version = ++privateDataVersionRef.current;
      if (!auth.isAuthenticated) {
        setBookings([]);
        return [];
      }
      const backendBookings = await loadBackendBookings(availableLodges);
      if (version !== privateDataVersionRef.current) return backendBookings;
      setBookings((current) => mergeBackendBookingSnapshot(current, backendBookings));
      return backendBookings;
    },
    [auth.isAuthenticated, auth.user?.id],
  );

  const refresh = useCallback(async () => {
    void notificationState.refresh();
    setIsSyncing(true);
    setSyncError(null);
    try {
      const backendLodges = await loadLodges();
      setIsBackendConnected(true);
      try {
        await loadPrivateData(backendLodges);
      } catch {
        if (auth.isAuthenticated)
          setSyncError('Account updates are temporarily unavailable. Lodge details are live.');
      }
    } catch {
      setIsBackendConnected(false);
      setSyncError('Live data is temporarily unavailable. Showing saved lodge information.');
    } finally {
      setIsSyncing(false);
    }
  }, [auth.isAuthenticated, loadLodges, loadPrivateData]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let mounted = true;
    const userId = auth.user?.id;
    if (!auth.isAuthenticated || !userId) {
      setPreferencesReady(false);
      setLoadedPreferencesUserId(null);
      setFavoriteIds([]);
      setBookingNotificationsEnabled(defaultPilgrimPreferences.bookingNotificationsEnabled);
      setLanguage(defaultPilgrimPreferences.language);
      return undefined;
    }

    setPreferencesReady(false);
    setLoadedPreferencesUserId(null);
    setFavoriteIds([]);
    setBookingNotificationsEnabled(defaultPilgrimPreferences.bookingNotificationsEnabled);
    setLanguage(defaultPilgrimPreferences.language);

    void loadPilgrimPreferences(userId).then((preferences) => {
      if (!mounted) return;
      setBookingNotificationsEnabled(preferences.bookingNotificationsEnabled);
      setFavoriteIds(preferences.favoriteIds);
      setLanguage(preferences.language);
      setLoadedPreferencesUserId(userId);
      setPreferencesReady(true);
    });

    return () => {
      mounted = false;
    };
  }, [auth.isAuthenticated, auth.user?.id]);

  useEffect(() => {
    if (!preferencesReady || !loadedPreferencesUserId || loadedPreferencesUserId !== auth.user?.id)
      return;
    void savePilgrimPreferences(loadedPreferencesUserId, {
      bookingNotificationsEnabled,
      favoriteIds,
      language,
    });
  }, [
    auth.user?.id,
    bookingNotificationsEnabled,
    favoriteIds,
    language,
    loadedPreferencesUserId,
    preferencesReady,
  ]);

  useEffect(() => {
    const event = realtime.lastBookingEvent;
    if (!event || !auth.isAuthenticated) return;
    const bookingId = getEventBookingId(event);
    if (bookingId) {
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId ? applyRealtimeBookingEvent(booking, event) : booking,
        ),
      );
    }
    void loadPrivateData(lodges).catch(() => undefined);
  }, [auth.isAuthenticated, loadPrivateData, lodges, realtime.lastBookingEvent]);

  useEffect(() => {
    if (auth.isAuthenticated && realtime.lastEvent?.name === 'notification:new')
      void loadPrivateData(lodges).catch(() => undefined);
  }, [auth.isAuthenticated, realtime.lastEvent, loadPrivateData, lodges]);

  useEffect(() => {
    const timer = setInterval(
      () => {
        if (AppState.currentState === 'active') void loadLodges().catch(() => undefined);
      },
      realtime.connected ? 120_000 : 45_000,
    );
    return () => clearInterval(timer);
  }, [loadLodges, realtime.connected]);

  useEffect(() => {
    if (realtime.connectionRevision > 0) void loadLodges().catch(() => undefined);
  }, [loadLodges, realtime.connectionRevision]);

  useEffect(() => {
    const event = realtime.lastEvent;
    if (
      !event ||
      !['lodge:catalog-updated', 'room:availability-updated', 'festival:updated'].includes(
        event.name,
      )
    )
      return;
    if (event.name === 'lodge:catalog-updated' && event.payload.isActive === false)
      setLodges((current) => current.filter((lodge) => lodge.id !== event.payload.lodgeId));
    const timer = setTimeout(() => {
      void loadLodges().catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [loadLodges, realtime.lastEvent]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (Date.now() - lastLodgeLoadAtRef.current < LODGE_FOREGROUND_REFRESH_MS) return;
      void loadLodges().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [loadLodges]);

  useEffect(() => {
    if (!auth.isAuthenticated || realtime.connectionRevision === 0) return;
    void loadPrivateData(lodges).catch(() => undefined);
  }, [auth.isAuthenticated, loadPrivateData, lodges, realtime.connectionRevision]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && auth.isAuthenticated)
        void loadPrivateData(lodges).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [auth.isAuthenticated, loadPrivateData, lodges]);

  // All pages share the same count; NotificationSync owns native badge writes.
  useEffect(() => {
    setUnreadCount(getNotificationUnreadCount());
    return subscribeNotificationUnreadCount((count) => {
      setUnreadCount(count);
    });
  }, []);

  const pendingBookingIds = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === 'pending')
        .map((booking) => booking.id)
        .sort()
        .join('|'),
    [bookings],
  );

  useEffect(() => {
    if (!auth.isAuthenticated || !pendingBookingIds) return undefined;
    const bookingIds = pendingBookingIds.split('|');
    let active = true;
    let requestInFlight = false;
    const syncPendingBookings = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const records = await Promise.all(
          bookingIds.map((bookingId) => getBookingRecord(bookingId).catch(() => null)),
        );
        if (!active) return;
        const recordsById = new Map(
          records
            .filter((record): record is NonNullable<typeof record> => record !== null)
            .map((record) => [record.id, record]),
        );
        setBookings((current) =>
          current.map((booking) => {
            const record = recordsById.get(booking.id);
            return record ? applyBackendBookingRecord(booking, record) : booking;
          }),
        );
      } finally {
        requestInFlight = false;
      }
    };
    void syncPendingBookings();
    const interval = setInterval(() => void syncPendingBookings(), 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [auth.isAuthenticated, pendingBookingIds]);

  const value = useMemo<PilgrimAppContextValue>(
    () => ({
      cacheLodgeSummaries,
      catalogRevision,
      bookingNotificationsEnabled,
      bookings,
      cancelBooking: async (id, reason) => {
        const cancelled = await cancelBackendBooking(id, reason);
        setBookings((current) =>
          current.map((booking) =>
            booking.id === id ? applyBackendBookingRecord(booking, cancelled) : booking,
          ),
        );
        // Cancellation has committed. A failed list/notification refresh must
        // not turn that success into a "could not cancel" alert.
        void loadPrivateData(lodges).catch(() => undefined);
      },
      createBooking: async (input) => {
        const lock = await createBookingLock({
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          lodgeId: input.lodgeId,
          roomTypeId: input.roomId,
        });
        const created = await createBackendBooking({
          checkoutDateFlexible: input.checkoutDateFlexible,
          guestEmail: input.guestEmail || undefined,
          guestIdProofMimeType: input.guestIdProof.mimeType,
          guestIdProofOriginalName: input.guestIdProof.originalName,
          guestIdProofSizeBytes: input.guestIdProof.sizeBytes,
          guestIdProofStoragePath: input.guestIdProof.storagePath,
          guestName: input.guestName.trim(),
          guestPhone: input.guestPhone.startsWith('+')
            ? input.guestPhone
            : `+91${input.guestPhone.replace(/\D/g, '')}`,
          lockCode: lock.lockCode,
          numberOfAdults: input.numberOfAdults,
          numberOfChildren: input.numberOfChildren,
          paymentMethod: input.paymentMethod,
          specialRequest: input.specialRequest?.trim() || undefined,
        });
        // Build the booking the checkout screen needs (just the id, for
        // navigation) entirely from data already in memory, so opening the
        // Razorpay sheet doesn't wait on a full bookings list refresh. The
        // authoritative list is reconciled in the background right after.
        const booking = mapBooking(synthesizeEnrichedBooking(created, lodges), lodges);
        setBookings((current) => [booking, ...current.filter((item) => item.id !== booking.id)]);
        void loadPrivateData(lodges).catch(() => undefined);
        return booking;
      },
      ensureLodgesHydrated,
      favoriteIds,
      isBackendConnected,
      isSyncing,
      language,
      lodges,
      markNotificationsRead: notificationState.markAllRead,
      markNotificationRead: notificationState.markRead,
      notifications,
      refresh,
      setBookingNotificationsEnabled,
      setLanguage,
      syncError,
      t: (english, marathi) => (language === 'mr' ? marathi : english),
      toggleFavorite: (lodgeId) => {
        setFavoriteIds((current) =>
          current.includes(lodgeId)
            ? current.filter((item) => item !== lodgeId)
            : [...current, lodgeId],
        );
      },
      unreadCount,
    }),
    [
      auth.isAuthenticated,
      cacheLodgeSummaries,
      catalogRevision,
      bookingNotificationsEnabled,
      bookings,
      ensureLodgesHydrated,
      favoriteIds,
      isBackendConnected,
      isSyncing,
      language,
      loadPrivateData,
      lodges,
      notifications,
      refresh,
      syncError,
      unreadCount,
    ],
  );

  return <PilgrimAppContext.Provider value={value}>{children}</PilgrimAppContext.Provider>;
}

export function usePilgrimApp(): PilgrimAppContextValue {
  const context = useContext(PilgrimAppContext);
  if (!context) throw new Error('usePilgrimApp must be used inside PilgrimAppProvider');
  return context;
}
