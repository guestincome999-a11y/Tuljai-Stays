import { ApiClient } from '@tuljai/shared';

import { tokenStorage } from '../auth/token-storage';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? '';

export const apiClient = new ApiClient({
  baseUrl: apiBaseUrl,
  getAccessToken: () => tokenStorage.getAccessToken(),
});
