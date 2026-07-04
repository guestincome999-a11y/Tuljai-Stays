import type { Lodge } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export async function listAssignedLodges(): Promise<Lodge[]> {
  return apiClient.get<Lodge[]>('/owner/lodges');
}
