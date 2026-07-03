import { ApiClient, readPublicEnvironment } from '@tuljai/shared';

import { tokenStorage } from '../auth/token-storage';

const environment = readPublicEnvironment(process.env);

export const apiClient = new ApiClient({
  baseUrl: environment.apiBaseUrl,
  getAccessToken: () => tokenStorage.getAccessToken(),
});
