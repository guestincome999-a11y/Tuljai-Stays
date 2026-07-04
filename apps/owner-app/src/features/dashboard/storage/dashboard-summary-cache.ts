import type { OwnerDashboardSummary } from '@tuljai/types';
import * as SecureStore from 'expo-secure-store';

const DASHBOARD_SUMMARY_KEY = 'tuljai.owner.dashboardSummary';

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function saveDashboardSummaryCache(summary: OwnerDashboardSummary): Promise<void> {
  if (!(await isSecureStoreAvailable())) {
    return;
  }

  await SecureStore.setItemAsync(DASHBOARD_SUMMARY_KEY, JSON.stringify(summary));
}

export async function loadDashboardSummaryCache(): Promise<OwnerDashboardSummary | null> {
  if (!(await isSecureStoreAvailable())) {
    return null;
  }

  const stored = await SecureStore.getItemAsync(DASHBOARD_SUMMARY_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as OwnerDashboardSummary;
  } catch {
    await SecureStore.deleteItemAsync(DASHBOARD_SUMMARY_KEY);
    return null;
  }
}
