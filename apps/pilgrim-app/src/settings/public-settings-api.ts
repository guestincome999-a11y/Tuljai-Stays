import type { FeatureFlag, SystemSetting } from '@tuljai/types';

import { apiClient } from '../api/client';

export async function listPublicSettings(): Promise<SystemSetting[]> {
  return apiClient.get<SystemSetting[]>('/settings/public');
}

export async function listPublicFeatureFlags(): Promise<FeatureFlag[]> {
  return apiClient.get<FeatureFlag[]>('/feature-flags/public');
}

export function isFestivalModeEnabled(settings: SystemSetting[], flags: FeatureFlag[]): boolean {
  const flag = flags.find((item) => item.key === 'festival_mode');
  const legacySetting = settings.find((item) => item.key === 'festival_mode');

  return flag?.enabled === true || legacySetting?.value === true;
}
