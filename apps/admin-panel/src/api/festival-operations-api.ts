import type { FestivalOperationsSnapshot } from '@tuljai/types';

import { apiClient } from './client';

export interface FestivalQuery {
  checkInDate: string;
  checkOutDate: string;
  search: string;
  filter: string;
  page: number;
}
export const getFestivalOperations = (query: FestivalQuery) =>
  apiClient.get<FestivalOperationsSnapshot>('/admin/festival-operations', { params: { ...query } });
export const updateFestivalMode = (input: {
  enabled: boolean;
  name: string;
  startDate: string;
  endDate: string;
  reason: string;
  expectedUpdatedAt: string;
}) => apiClient.request('/admin/festival-operations/mode', { method: 'PATCH', body: input });
export const updateFestivalLodge = (
  id: string,
  input: {
    isActive: boolean;
    reason: string;
    detail: string;
    expectedUpdatedAt: string;
    checkInDate: string;
    checkOutDate: string;
  },
) => apiClient.request(`/admin/festival-operations/lodges/${id}`, { method: 'PATCH', body: input });
export const reconcileFestivalPayment = (id: string, reason: string) =>
  apiClient.post<{ status: string; bookingId: string | null }>(
    `/admin/festival-operations/payments/${id}/reconcile`,
    { reason },
  );
