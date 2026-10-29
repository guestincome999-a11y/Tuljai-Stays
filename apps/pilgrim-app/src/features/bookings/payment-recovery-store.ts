import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Only an order reference; never guest data, signatures or payment credentials.
const key = (userId: string) => `tuljai.pending-payment.${userId}`;

export async function readPendingPayment(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage.getItem(key(userId));
  return SecureStore.getItemAsync(key(userId));
}

export async function rememberPendingPayment(userId: string, orderId: string): Promise<void> {
  if (Platform.OS === 'web') globalThis.localStorage.setItem(key(userId), orderId);
  else await SecureStore.setItemAsync(key(userId), orderId);
}

export async function clearPendingPayment(userId: string): Promise<void> {
  if (Platform.OS === 'web') globalThis.localStorage.removeItem(key(userId));
  else await SecureStore.deleteItemAsync(key(userId));
}
