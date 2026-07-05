import * as SecureStore from 'expo-secure-store';

const OWNER_SETTINGS_KEY = 'tuljai.owner.operationalSettings';

export type OwnerThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK';
export type OwnerLanguage = 'EN' | 'MR' | 'HI';
export type OwnerDashboardTab = 'DASHBOARD' | 'BOOKINGS' | 'REGISTER' | 'ROOMS';

export interface OwnerOperationalSettings {
  autoOpenScannerAfterCheckIn: boolean;
  dashboardTab: OwnerDashboardTab;
  language: OwnerLanguage;
  largeTextMode: boolean;
  notificationSound: boolean;
  receptionModeDefault: boolean;
  themeMode: OwnerThemeMode;
  vibration: boolean;
}

export const defaultOwnerSettings: OwnerOperationalSettings = {
  autoOpenScannerAfterCheckIn: false,
  dashboardTab: 'DASHBOARD',
  language: 'EN',
  largeTextMode: false,
  notificationSound: true,
  receptionModeDefault: false,
  themeMode: 'SYSTEM',
  vibration: true,
};

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function loadOwnerSettings(): Promise<OwnerOperationalSettings> {
  if (!(await isSecureStoreAvailable())) {
    return defaultOwnerSettings;
  }

  const stored = await SecureStore.getItemAsync(OWNER_SETTINGS_KEY);

  if (!stored) {
    return defaultOwnerSettings;
  }

  try {
    return {
      ...defaultOwnerSettings,
      ...(JSON.parse(stored) as Partial<OwnerOperationalSettings>),
    };
  } catch {
    await SecureStore.deleteItemAsync(OWNER_SETTINGS_KEY);
    return defaultOwnerSettings;
  }
}

export async function saveOwnerSettings(settings: OwnerOperationalSettings): Promise<void> {
  if (!(await isSecureStoreAvailable())) {
    return;
  }

  await SecureStore.setItemAsync(OWNER_SETTINGS_KEY, JSON.stringify(settings));
}
