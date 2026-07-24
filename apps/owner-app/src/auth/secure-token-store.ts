import * as SecureStore from 'expo-secure-store';

import { getWebSessionStorage } from './web-session-storage';

const ACCESS_TOKEN_KEY = 'tuljai.owner.accessToken';
const REFRESH_TOKEN_KEY = 'tuljai.owner.refreshToken';

let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export const secureTokenStore = {
  async clear(): Promise<void> {
    cachedAccessToken = null;
    cachedRefreshToken = null;
    const webStorage = getWebSessionStorage();
    webStorage?.removeItem(ACCESS_TOKEN_KEY);
    webStorage?.removeItem(REFRESH_TOKEN_KEY);

    if (!(await isSecureStoreAvailable())) {
      return;
    }

    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    if (!(await isSecureStoreAvailable())) {
      return getWebSessionStorage()?.getItem(ACCESS_TOKEN_KEY) ?? cachedAccessToken;
    }

    cachedAccessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    return cachedAccessToken;
  },

  async getRefreshToken(): Promise<string | null> {
    if (!(await isSecureStoreAvailable())) {
      return getWebSessionStorage()?.getItem(REFRESH_TOKEN_KEY) ?? cachedRefreshToken;
    }

    cachedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    return cachedRefreshToken;
  },

  async setTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
    cachedAccessToken = tokens.accessToken;
    cachedRefreshToken = tokens.refreshToken;
    const webStorage = getWebSessionStorage();
    webStorage?.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    webStorage?.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);

    if (!(await isSecureStoreAvailable())) {
      return;
    }

    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
  },

  async setAccessToken(accessToken: string): Promise<void> {
    cachedAccessToken = accessToken;
    getWebSessionStorage()?.setItem(ACCESS_TOKEN_KEY, accessToken);

    if (!(await isSecureStoreAvailable())) {
      return;
    }

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  },
};
