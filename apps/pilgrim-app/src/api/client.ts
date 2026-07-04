import { ApiClient, readPublicEnvironment } from '@tuljai/shared';

import { secureTokenStore } from '../auth/secure-token-store';

const environment = readPublicEnvironment(process.env);

export const apiClient = new ApiClient({
  baseUrl: environment.apiBaseUrl,
  getAccessToken: () => secureTokenStore.getAccessToken(),
});
