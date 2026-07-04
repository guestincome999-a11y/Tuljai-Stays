import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'tuljai.owner.accessToken';
const REFRESH_TOKEN_KEY = 'tuljai.owner.refreshToken';

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export const secureTokenStore = {
  async clear(): Promise<void> {
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
      return null;
    }

    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    if (!(await isSecureStoreAvailable())) {
      return null;
    }

    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async setTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
    if (!(await isSecureStoreAvailable())) {
      return;
    }

    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
  },
};
