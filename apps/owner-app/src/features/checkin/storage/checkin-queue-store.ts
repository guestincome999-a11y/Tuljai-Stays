import * as SecureStore from 'expo-secure-store';

import { getWebSessionStorage } from '../../../auth/web-session-storage';
import { recognizeQr, type RecognizedQr } from '../scan-operation';

// Small per-operation encrypted records avoid SecureStore's per-value size limits.
// Each owner has a separate namespace; no booking PII or auth tokens are queued.
export function checkinQueueStorage(userId: string) {
  const prefix = `tuljai.owner.checkin.${userId}`;
  async function read(key: string) {
    if (await SecureStore.isAvailableAsync()) return SecureStore.getItemAsync(key);
    const storage = getWebSessionStorage();
    if (!storage) throw new Error('Persistent storage unavailable');
    return storage.getItem(key);
  }
  async function write(key: string, value: string) {
    if (await SecureStore.isAvailableAsync()) return SecureStore.setItemAsync(key, value);
    const storage = getWebSessionStorage();
    if (!storage) throw new Error('Persistent storage unavailable');
    storage.setItem(key, value);
  }
  return {
    async load(): Promise<RecognizedQr[]> {
      const keys = JSON.parse((await read(prefix)) ?? '[]') as string[];
      if (!Array.isArray(keys) || keys.length > 40) throw new Error('Invalid pending scan index');
      const result: RecognizedQr[] = [];
      for (const key of keys) {
        const payload = await read(`${prefix}.${key}`);
        const qr = payload ? recognizeQr(payload) : null;
        if (!qr || qr.key !== key) throw new Error('Pending scan could not be restored');
        result.push(qr);
      }
      return result;
    },
    async save(items: RecognizedQr[]) {
      const previous = JSON.parse((await read(prefix)) ?? '[]') as string[];
      for (const item of items) await write(`${prefix}.${item.key}`, item.qrPayload);
      await write(prefix, JSON.stringify(items.map((item) => item.key)));
      for (const key of previous.filter((key) => !items.some((item) => item.key === key))) {
        if (await SecureStore.isAvailableAsync())
          await SecureStore.deleteItemAsync(`${prefix}.${key}`);
        else getWebSessionStorage()?.removeItem(`${prefix}.${key}`);
      }
    },
  };
}
