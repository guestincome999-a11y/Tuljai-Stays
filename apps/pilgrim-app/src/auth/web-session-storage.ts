import { Platform } from 'react-native';

export function getWebSessionStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;

  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
