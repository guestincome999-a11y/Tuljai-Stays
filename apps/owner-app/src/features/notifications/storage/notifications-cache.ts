import type { Notification } from '@tuljai/types';
import * as SecureStore from 'expo-secure-store';

const NOTIFICATIONS_CACHE_KEY = 'tuljai.owner.notifications';

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function saveNotificationsCache(notifications: Notification[]): Promise<void> {
  if (!(await isSecureStoreAvailable())) {
    return;
  }

  await SecureStore.setItemAsync(NOTIFICATIONS_CACHE_KEY, JSON.stringify(notifications));
}

export async function loadNotificationsCache(): Promise<Notification[]> {
  if (!(await isSecureStoreAvailable())) {
    return [];
  }

  const stored = await SecureStore.getItemAsync(NOTIFICATIONS_CACHE_KEY);

  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as Notification[];
  } catch {
    await SecureStore.deleteItemAsync(NOTIFICATIONS_CACHE_KEY);
    return [];
  }
}
