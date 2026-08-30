import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/auth-context';
import {
  cancelBooking as cancelBackendBooking,
  createBooking as createBackendBooking,
  createBookingLock,
  getBookingRecord,
  type GuestIdProofFile,
  uploadGuestIdProof,
} from '../features/bookings/api/bookings-api';
import {
  markAllNotificationsRead,
  markNotificationRead as markBackendNotificationRead,
} from '../features/notifications/api/notifications-api';
import { getEventBookingId, type PilgrimRealtimeEvent } from '../realtime/realtime-events';
import { useRealtime } from '../realtime/realtime-provider';

import {
  applyBackendBookingRecord,
  getFallbackNotifications,
  hydrateBackendLodge,
  loadBackendBookings,
  loadBackendNotifications,
  loadLodgeSummaries,
} from './backend-sync';
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

interface CreateBookingInput {
  checkInDate: string;
  checkOutDate: string;
  checkoutDateFlexible: boolean;
  guestEmail?: string;
  guestIdProof: GuestIdProofFile;
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
  const [bookings, setBookings] = useState<PilgrimBooking[]>(
    mockMode ? initialPilgrimBookings : [],
  );
  const [notifications, setNotifications] = useState<PilgrimNotification[]>(
    mockMode ? getFallbackNotifications() : [],
  );
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Tracks lodge ids currently being hydrated so ensureLodgesHydrated can be
  // called repeatedly (e.g. from a scroll handler) without firing duplicate
  // detail requests for the same lodge.
  const hydratingIdsRef = useRef<Set<string>>(new Set());

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
        void hydrateBackendLodge(lodge)
          .then((hydratedLodge) => {
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

  const loadLodges = useCallback(async (): Promise<PilgrimLodge[]> => {
    const summaries = await loadLodgeSummaries();
    setLodges(summaries);
    hydratingIdsRef.current.clear();
    setFavoriteIds((current) =>
      current.map((favoriteId) => {
        const matchingLodge = summaries.find(
          (lodge) => lodge.id === favoriteId || lodge.slug === favoriteId,
        );
        return matchingLodge?.id ?? favoriteId;
      }),
    );
    return summaries;
  }, []);

  const loadPrivateData = useCallback(
    async (availableLodges: PilgrimLodge[]): Promise<PilgrimBooking[]> => {
      if (!auth.isAuthenticated) {
        setBookings([]);
        setNotifications([]);
        return [];
      }
      const [backendBookings, backendNotifications] = await Promise.all([
        loadBackendBookings(availableLodges),
        loadBackendNotifications(),
      ]);
      setBookings((current) => mergeBackendBookingSnapshot(current, backendBookings));
      setNotifications(backendNotifications);
      return backendBookings;
    },
    [auth.isAuthenticated],
  );

  const refresh = useCallback(async () => {
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
    if (!auth.isAuthenticated || realtime.lastEvent?.name !== 'notification:new') return;
    void loadBackendNotifications()
      .then(setNotifications)
      .catch(() => undefined);
  }, [auth.isAuthenticated, realtime.lastEvent]);

  useEffect(() => {
    if (realtime.lastEvent?.name !== 'lodge:catalog-updated') return;
    void loadLodges().catch(() => undefined);
  }, [loadLodges, realtime.lastEvent]);

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
      bookingNotificationsEnabled,
      bookings,
      cancelBooking: async (id, reason) => {
        await cancelBackendBooking(id, reason);
        await loadPrivateData(lodges);
      },
      createBooking: async (input) => {
        const uploadedIdProof = await uploadGuestIdProof(input.guestIdProof);
        const lock = await createBookingLock({
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          lodgeId: input.lodgeId,
          roomTypeId: input.roomId,
        });
        const created = await createBackendBooking({
          checkoutDateFlexible: input.checkoutDateFlexible,
          guestEmail: input.guestEmail || undefined,
          guestIdProofMimeType: uploadedIdProof.mimeType,
          guestIdProofOriginalName: uploadedIdProof.originalName,
          guestIdProofSizeBytes: uploadedIdProof.sizeBytes,
          guestIdProofStoragePath: uploadedIdProof.storagePath,
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
        const refreshedBookings = await loadPrivateData(lodges);
        const booking = refreshedBookings.find((item) => item.id === created.id);
        if (!booking) throw new Error('Created booking could not be refreshed');
        return booking;
      },
      ensureLodgesHydrated,
      favoriteIds,
      isBackendConnected,
      isSyncing,
      language,
      lodges,
      markNotificationsRead: async () => {
        setNotifications((current) => current.map((item) => ({ ...item, read: true })));
        if (auth.isAuthenticated) await markAllNotificationsRead().catch(() => undefined);
      },
      markNotificationRead: async (id) => {
        setNotifications((current) =>
          current.map((item) => (item.id === id ? { ...item, read: true } : item)),
        );
        if (auth.isAuthenticated) await markBackendNotificationRead(id).catch(() => undefined);
      },
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
    }),
    [
      auth.isAuthenticated,
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
    ],
  );

  return <PilgrimAppContext.Provider value={value}>{children}</PilgrimAppContext.Provider>;
}

export function usePilgrimApp(): PilgrimAppContextValue {
  const context = useContext(PilgrimAppContext);
  if (!context) throw new Error('usePilgrimApp must be used inside PilgrimAppProvider');
  return context;
}

function applyRealtimeBookingEvent(
  booking: PilgrimBooking,
  event: PilgrimRealtimeEvent,
): PilgrimBooking {
  const updatedAt =
    typeof event.payload.updatedAt === 'string'
      ? event.payload.updatedAt
      : new Date(event.receivedAt).toISOString();
  if (event.name === 'booking:accepted' || event.name === 'qr:generated')
    return { ...booking, qrReady: true, status: 'confirmed', updatedAt };
  if (
    event.name === 'booking:cancelled' ||
    event.name === 'booking:rejected' ||
    event.name === 'booking:expired'
  )
    return { ...booking, qrReady: false, status: 'cancelled', updatedAt };
  if (event.name === 'checkin:completed')
    return { ...booking, qrReady: false, status: 'checked-in', updatedAt };
  if (event.name === 'checkout:completed')
    return { ...booking, qrReady: false, status: 'completed', updatedAt };
  return booking;
}

function mergeBackendBookingSnapshot(
  current: PilgrimBooking[],
  backend: PilgrimBooking[],
): PilgrimBooking[] {
  const currentById = new Map(current.map((booking) => [booking.id, booking]));
  return backend.map((booking) => {
    const existing = currentById.get(booking.id);
    if (!existing) return booking;
    const existingUpdatedAt = Date.parse(existing.updatedAt);
    const backendUpdatedAt = Date.parse(booking.updatedAt);
    return Number.isFinite(existingUpdatedAt) &&
      Number.isFinite(backendUpdatedAt) &&
      existingUpdatedAt > backendUpdatedAt
      ? existing
      : booking;
  });
}
