import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '../auth/auth-context';
import {
  cancelBooking as cancelBackendBooking,
  createBooking as createBackendBooking,
  createBookingLock,
  type GuestIdProofFile,
  uploadGuestIdProof,
} from '../features/bookings/api/bookings-api';
import {
  markAllNotificationsRead,
  markNotificationRead as markBackendNotificationRead,
} from '../features/notifications/api/notifications-api';
import { useRealtime } from '../realtime/realtime-provider';

import {
  getFallbackNotifications,
  loadBackendBookings,
  loadBackendLodges,
  loadBackendNotifications,
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
  roomId: string;
  specialRequest?: string;
}

interface PilgrimAppContextValue {
  bookingNotificationsEnabled: boolean;
  bookings: PilgrimBooking[];
  cancelBooking: (id: string, reason?: string) => Promise<void>;
  createBooking: (input: CreateBookingInput) => Promise<PilgrimBooking>;
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

  const loadLodges = useCallback(async (): Promise<PilgrimLodge[]> => {
    const backendLodges = await loadBackendLodges();
    setLodges(backendLodges);
    setFavoriteIds((current) =>
      current.map((favoriteId) => {
        const matchingLodge = backendLodges.find(
          (lodge) => lodge.id === favoriteId || lodge.slug === favoriteId,
        );
        return matchingLodge?.id ?? favoriteId;
      }),
    );
    return backendLodges;
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
      setBookings(backendBookings);
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
      await loadPrivateData(backendLodges);
      setIsBackendConnected(true);
    } catch {
      setIsBackendConnected(false);
      setSyncError('Live data is temporarily unavailable. Showing saved lodge information.');
    } finally {
      setIsSyncing(false);
    }
  }, [loadLodges, loadPrivateData]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let mounted = true;
    void loadPilgrimPreferences().then((preferences) => {
      if (!mounted) return;
      setBookingNotificationsEnabled(preferences.bookingNotificationsEnabled);
      setFavoriteIds(preferences.favoriteIds);
      setLanguage(preferences.language);
      setPreferencesReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    void savePilgrimPreferences({ bookingNotificationsEnabled, favoriteIds, language });
  }, [bookingNotificationsEnabled, favoriteIds, language, preferencesReady]);

  useEffect(() => {
    if (!realtime.lastEvent || !auth.isAuthenticated) return;
    void loadPrivateData(lodges).catch(() => undefined);
  }, [auth.isAuthenticated, loadPrivateData, lodges, realtime.lastEvent]);

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
          specialRequest: input.specialRequest?.trim() || undefined,
        });
        const refreshedBookings = await loadPrivateData(lodges);
        const booking = refreshedBookings.find((item) => item.id === created.id);
        if (!booking) throw new Error('Created booking could not be refreshed');
        return booking;
      },
      favoriteIds,
      isBackendConnected,
      isSyncing,
      language,
      lodges,
      markNotificationsRead: async () => {
        setNotifications((current) => current.map((item) => ({ ...item, read: true })));
        if (auth.isAuthenticated) {
          await markAllNotificationsRead().catch(() => undefined);
        }
      },
      markNotificationRead: async (id) => {
        setNotifications((current) =>
          current.map((item) => (item.id === id ? { ...item, read: true } : item)),
        );
        if (auth.isAuthenticated) {
          await markBackendNotificationRead(id).catch(() => undefined);
        }
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
