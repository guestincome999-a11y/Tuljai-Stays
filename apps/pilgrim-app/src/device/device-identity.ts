import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { getWebSessionStorage } from '../auth/web-session-storage';

const DEVICE_ID_KEY = 'tuljai.pilgrim.deviceId';

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

  const webStorage = getWebSessionStorage();
  const existing = webStorage?.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const nextId = createDeviceId();
  webStorage?.setItem(DEVICE_ID_KEY, nextId);
  return nextId;
}

export function getDeviceName(): string {
  if (Platform.OS === 'ios') {
    return 'iPhone';
  }

  if (Platform.OS === 'android') {
    return 'Android phone';
  }

  return 'Web browser';
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
  return `pilgrim-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
