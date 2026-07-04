import type { Lodge } from '@tuljai/types';
import * as SecureStore from 'expo-secure-store';

const SELECTED_LODGE_ID_KEY = 'tuljai.owner.selectedLodgeId';
const SELECTED_LODGE_KEY = 'tuljai.owner.selectedLodge';

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function getSelectedLodgeId(): Promise<string | null> {
  if (!(await isSecureStoreAvailable())) {
    return null;
  }

  return SecureStore.getItemAsync(SELECTED_LODGE_ID_KEY);
}

export async function getCachedSelectedLodge(): Promise<Lodge | null> {
  if (!(await isSecureStoreAvailable())) {
    return null;
  }

  const stored = await SecureStore.getItemAsync(SELECTED_LODGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as Lodge;
  } catch {
    await clearSelectedLodge();
    return null;
  }
}

export async function saveSelectedLodge(lodge: Lodge): Promise<void> {
  if (!(await isSecureStoreAvailable())) {
    return;
  }

  await Promise.all([
    SecureStore.setItemAsync(SELECTED_LODGE_ID_KEY, lodge.id),
    SecureStore.setItemAsync(SELECTED_LODGE_KEY, JSON.stringify(lodge)),
  ]);
}

export async function clearSelectedLodge(): Promise<void> {
  if (!(await isSecureStoreAvailable())) {
    return;
  }

  await Promise.all([
    SecureStore.deleteItemAsync(SELECTED_LODGE_ID_KEY),
    SecureStore.deleteItemAsync(SELECTED_LODGE_KEY),
  ]);
}
