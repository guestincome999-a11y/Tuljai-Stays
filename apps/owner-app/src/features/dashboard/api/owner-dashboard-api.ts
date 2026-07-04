import type { OwnerDashboardSummary } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export async function getOwnerDashboardSummary(): Promise<OwnerDashboardSummary> {
  return apiClient.get<OwnerDashboardSummary>('/owner/dashboard/summary');
}
