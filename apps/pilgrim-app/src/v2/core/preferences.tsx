import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { useLang } from '../i18n/language';

import { useSession } from './useSession';

// Same storage key as the previous app, so each person keeps their saved stays and settings.
const PREFERENCES_KEY_PREFIX = 'tuljai.pilgrim.preferences';
const V2_LANGUAGE_KEY = 'tuljai.pilgrim.v2.language';

interface StoredPreferences {
  bookingNotificationsEnabled: boolean;
  favoriteIds: string[];
  language: 'en' | 'mr';
}

const DEFAULTS: StoredPreferences = {
  bookingNotificationsEnabled: true,
  favoriteIds: [],
  language: 'en',
};

function parse(stored: string | null): StoredPreferences {
  if (!stored) return DEFAULTS;
  try {
    const value = JSON.parse(stored) as Partial<StoredPreferences>;
    return {
      bookingNotificationsEnabled:
        typeof value.bookingNotificationsEnabled === 'boolean'
          ? value.bookingNotificationsEnabled
          : DEFAULTS.bookingNotificationsEnabled,
      favoriteIds: Array.isArray(value.favoriteIds)
        ? value.favoriteIds.filter((item): item is string => typeof item === 'string')
        : DEFAULTS.favoriteIds,
      language: value.language === 'mr' ? 'mr' : 'en',
    };
  } catch {
    return DEFAULTS;
  }
}

interface PreferencesContextValue {
  bookingNotificationsEnabled: boolean;
  favoriteIds: string[];
  isSaved: (lodgeId: string) => boolean;
  setBookingNotificationsEnabled: (enabled: boolean) => void;
  toggleSaved: (lodgeId: string) => void;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  bookingNotificationsEnabled: true,
  favoriteIds: [],
  isSaved: () => false,
  setBookingNotificationsEnabled: () => undefined,
  toggleSaved: () => undefined,
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const { lang, setLang } = useLang();
  const userId = session.user?.id ?? null;
  const [prefs, setPrefs] = useState<StoredPreferences>(DEFAULTS);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    if (!userId) {
      setPrefs(DEFAULTS);
      return;
    }
    let cancelled = false;
    void (async () => {
      const stored = parse(
        await SecureStore.getItemAsync(`${PREFERENCES_KEY_PREFIX}.${userId}`).catch(() => null),
      );
      if (cancelled) return;
      setPrefs(stored);
      // Carry over the language chosen in the previous app, once.
      const chosen = await SecureStore.getItemAsync(V2_LANGUAGE_KEY).catch(() => null);
      if (!cancelled && chosen === null && stored.language === 'mr') setLang('mr');
    })();
    return () => {
      cancelled = true;
    };
  }, [setLang, userId]);

  const persist = useCallback(
    (next: StoredPreferences) => {
      setPrefs(next);
      if (!userId) return;
      void SecureStore.setItemAsync(
        `${PREFERENCES_KEY_PREFIX}.${userId}`,
        JSON.stringify({ ...next, language: langRef.current }),
      ).catch(() => undefined);
    },
    [userId],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      bookingNotificationsEnabled: prefs.bookingNotificationsEnabled,
      favoriteIds: prefs.favoriteIds,
      isSaved: (lodgeId) => prefs.favoriteIds.includes(lodgeId),
      setBookingNotificationsEnabled: (enabled) =>
        persist({ ...prefs, bookingNotificationsEnabled: enabled }),
      toggleSaved: (lodgeId) =>
        persist({
          ...prefs,
          favoriteIds: prefs.favoriteIds.includes(lodgeId)
            ? prefs.favoriteIds.filter((id) => id !== lodgeId)
            : [lodgeId, ...prefs.favoriteIds],
        }),
    }),
    [persist, prefs],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}
