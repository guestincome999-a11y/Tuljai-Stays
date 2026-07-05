import type { GuestRegister } from '@tuljai/types';
import * as SecureStore from 'expo-secure-store';

const REGISTER_DASHBOARD_CACHE_KEY = 'tuljai.owner.registerDashboard';

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function saveRegisterDashboardCache(registers: GuestRegister[]): Promise<void> {
  if (!(await isSecureStoreAvailable())) {
    return;
  }

  await SecureStore.setItemAsync(REGISTER_DASHBOARD_CACHE_KEY, JSON.stringify(registers));
}

export async function loadRegisterDashboardCache(): Promise<GuestRegister[]> {
  if (!(await isSecureStoreAvailable())) {
    return [];
  }

  const stored = await SecureStore.getItemAsync(REGISTER_DASHBOARD_CACHE_KEY);

  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as GuestRegister[];
  } catch {
    await SecureStore.deleteItemAsync(REGISTER_DASHBOARD_CACHE_KEY);
    return [];
  }
}
