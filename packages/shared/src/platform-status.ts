import type { FeatureFlag, SystemSetting } from '@tuljai/types';

import type { ApiClient } from './api-client';

export type PlatformAppKey = 'admin' | 'owner' | 'pilgrim';

export interface PlatformStatus {
  maintenanceActive: boolean;
  maintenanceMessage: string | null;
}

const DEFAULT_MAINTENANCE_MESSAGE =
  'Tuljai Stays is undergoing scheduled maintenance. Please try again shortly.';

/**
 * Reads the platform-wide `maintenance_mode` feature flag and the most specific available
 * maintenance message (per-app message first, falling back to the general app-wide message) from
 * the backend's public, unauthenticated settings/feature-flag endpoints. Used to gate app usage
 * client-side so a maintenance window toggled from the admin panel actually takes effect for
 * pilgrims and owners, not just as a stored setting nothing reads.
 */
export async function fetchPlatformStatus(
  client: Pick<ApiClient, 'get'>,
  appKey: PlatformAppKey,
): Promise<PlatformStatus> {
  const [flags, settings] = await Promise.all([
    client.get<FeatureFlag[]>('/feature-flags/public'),
    client.get<SystemSetting[]>('/settings/public'),
  ]);

  const maintenanceFlag = flags.find((flag) => flag.key === 'maintenance_mode');
  const maintenanceActive = maintenanceFlag?.enabled === true;

  if (!maintenanceActive) {
    return { maintenanceActive: false, maintenanceMessage: null };
  }

  const perAppMessage = settings.find((setting) => setting.key === `${appKey}_app_maintenance_message`);
  const generalMessage = settings.find((setting) => setting.key === 'app_maintenance_message');
  const message = firstNonEmptyString(perAppMessage?.value, generalMessage?.value);

  return {
    maintenanceActive: true,
    maintenanceMessage: message ?? DEFAULT_MAINTENANCE_MESSAGE,
  };
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}
