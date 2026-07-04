import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'tuljai.owner.deviceId';

export async function getOrCreateDeviceId(): Promise<string> {
  if (await SecureStore.isAvailableAsync()) {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);

    if (existing) {
      return existing;
    }

    const nextId = createDeviceId();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, nextId);
    return nextId;
  }

  return createDeviceId();
}

export function getDeviceName(): string {
  if (Platform.OS === 'ios') {
    return 'Owner iPhone';
  }

  if (Platform.OS === 'android') {
    return 'Owner Android phone';
  }

  return 'Owner web browser';
}

export function getDevicePlatform(): 'ANDROID' | 'IOS' | 'WEB' | 'UNKNOWN' {
  if (Platform.OS === 'android') {
    return 'ANDROID';
  }

  if (Platform.OS === 'ios') {
    return 'IOS';
  }

  if (Platform.OS === 'web') {
    return 'WEB';
  }

  return 'UNKNOWN';
}

function createDeviceId(): string {
  return `owner-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
