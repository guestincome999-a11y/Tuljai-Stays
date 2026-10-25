import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { PilgrimLanguage } from './PilgrimAppProvider';

const PREFERENCES_KEY_PREFIX = 'tuljai.pilgrim.preferences';

export interface PilgrimPreferences {
  bookingNotificationsEnabled: boolean;
  favoriteIds: string[];
  language: PilgrimLanguage;
}

export const defaultPilgrimPreferences: PilgrimPreferences = {
  bookingNotificationsEnabled: true,
  favoriteIds: [],
  language: 'en',
};

export async function loadPilgrimPreferences(userId: string): Promise<PilgrimPreferences> {
  const stored = await readPreferences(userId);
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

export async function savePilgrimPreferences(
  userId: string,
  preferences: PilgrimPreferences,
): Promise<void> {
  const serialized = JSON.stringify(preferences);
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(getPreferencesKey(userId), serialized);
    return;
  }

  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.setItemAsync(getPreferencesKey(userId), serialized);
  }
}

async function readPreferences(userId: string): Promise<string | null> {
  const webStorage = getWebStorage();
  if (webStorage) return webStorage.getItem(getPreferencesKey(userId));
  if (await SecureStore.isAvailableAsync()) {
    return SecureStore.getItemAsync(getPreferencesKey(userId));
  }
  return null;
}

function getPreferencesKey(userId: string): string {
  return `${PREFERENCES_KEY_PREFIX}.${userId}`;
}

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;

  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
