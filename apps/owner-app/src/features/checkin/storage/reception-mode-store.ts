import * as SecureStore from 'expo-secure-store';

const RECEPTION_MODE_KEY = 'tuljai.owner.receptionMode';

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function loadReceptionMode(): Promise<boolean> {
  if (!(await isSecureStoreAvailable())) {
    return false;
  }

  return (await SecureStore.getItemAsync(RECEPTION_MODE_KEY)) === 'true';
}

export async function saveReceptionMode(enabled: boolean): Promise<void> {
  if (!(await isSecureStoreAvailable())) {
    return;
  }

  await SecureStore.setItemAsync(RECEPTION_MODE_KEY, String(enabled));
}
