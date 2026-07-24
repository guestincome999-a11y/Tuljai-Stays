import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { PilgrimLanguage } from './PilgrimAppProvider';

const PREFERENCES_KEY = 'tuljai.pilgrim.preferences';

export interface PilgrimPreferences {
  bookingNotificationsEnabled: boolean;
  favoriteIds: string[];
  language: PilgrimLanguage;
}

export const defaultPilgrimPreferences: PilgrimPreferences = {
  bookingNotificationsEnabled: true,
  favoriteIds: ['bhavani-bhakt'],
  language: 'en',
};

export async function loadPilgrimPreferences(): Promise<PilgrimPreferences> {
  const stored = await readPreferences();
  if (!stored) return defaultPilgrimPreferences;

  try {
    const parsed = JSON.parse(stored) as Partial<PilgrimPreferences>;
    return {
      bookingNotificationsEnabled:
        typeof parsed.bookingNotificationsEnabled === 'boolean'
          ? parsed.bookingNotificationsEnabled
          : defaultPilgrimPreferences.bookingNotificationsEnabled,
      favoriteIds: Array.isArray(parsed.favoriteIds)
        ? parsed.favoriteIds.filter((item): item is string => typeof item === 'string')
        : defaultPilgrimPreferences.favoriteIds,
      language: parsed.language === 'mr' ? 'mr' : 'en',
    };
  } catch {
    return defaultPilgrimPreferences;
  }
}

export async function savePilgrimPreferences(preferences: PilgrimPreferences): Promise<void> {
  const serialized = JSON.stringify(preferences);
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(PREFERENCES_KEY, serialized);
    return;
  }

  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.setItemAsync(PREFERENCES_KEY, serialized);
  }
}

async function readPreferences(): Promise<string | null> {
  const webStorage = getWebStorage();
  if (webStorage) return webStorage.getItem(PREFERENCES_KEY);
  if (await SecureStore.isAvailableAsync()) return SecureStore.getItemAsync(PREFERENCES_KEY);
  return null;
}

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;

  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
