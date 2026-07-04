import type { SystemSetting } from '@tuljai/types';

import { apiClient } from '../api/client';

export async function listPublicSettings(): Promise<SystemSetting[]> {
  return apiClient.get<SystemSetting[]>('/settings/public');
}

export function isFestivalModeEnabled(settings: SystemSetting[]): boolean {
  const setting = settings.find((item) => item.key === 'festival_mode');

  return setting?.value === true;
}
