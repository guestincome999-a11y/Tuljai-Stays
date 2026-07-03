import { isNonEmptyString } from '@tuljai/utils';

export interface PublicEnvironment {
  apiBaseUrl: string;
}

export function readPublicEnvironment(
  source: Record<string, string | undefined>,
): PublicEnvironment {
  const apiBaseUrl =
    source.EXPO_PUBLIC_API_BASE_URL ?? source.NEXT_PUBLIC_API_BASE_URL ?? source.API_BASE_URL;

  if (!isNonEmptyString(apiBaseUrl)) {
    throw new Error('API base URL is not configured');
  }

  return { apiBaseUrl };
}
