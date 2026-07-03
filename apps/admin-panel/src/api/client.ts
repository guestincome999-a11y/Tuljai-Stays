import { ApiClient, readPublicEnvironment } from '@tuljai/shared';

const environment = readPublicEnvironment(process.env);

export const apiClient = new ApiClient({
  baseUrl: environment.apiBaseUrl,
});
