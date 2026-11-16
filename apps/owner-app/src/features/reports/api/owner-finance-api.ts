import type {
  CommissionPaymentDetail,
  CommissionPaymentRecord,
  OwnerFinancePage,
  RevenueSettlementDetail,
} from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface FinanceFilters {
  startDate?: string;
  endDate?: string;
  day?: string;
  page?: number;
  kind?: string;
  format?: string;
}
export const loadOwnerFinance = (id: string, params: FinanceFilters = {}) =>
  apiClient.get<OwnerFinancePage>(`/owner/lodges/${id}/finance`, { params });
export const loadCommissionHistory = (id: string, page: number) =>
  apiClient.get<{ items: CommissionPaymentRecord[]; totalItems: number; page: number }>(
    `/owner/lodges/${id}/commission/payments`,
    { params: { page, limit: 30 } },
  );
export const createCommissionOrder = (
  id: string,
  expectedPaise: number,
  paymentMode: 'FULL' | 'PARTIAL' = 'FULL',
) =>
  apiClient.post<CommissionPaymentRecord>(`/owner/lodges/${id}/commission/payments`, {
    expectedPaise,
    paymentMode,
  });
export const reconcileCommission = (id: string) =>
  apiClient.post<CommissionPaymentDetail>(`/owner/commission/payments/${id}/reconcile`, {});
export const verifyCommission = (
  id: string,
  input: { orderId: string; paymentId: string; signature: string },
) => apiClient.post<CommissionPaymentDetail>(`/owner/commission/payments/${id}/verify`, input);
export const commissionDetail = (id: string) =>
  apiClient.get<CommissionPaymentDetail>(`/owner/commission/payments/${id}`);
export const cancelCommissionCheckout = (id: string) =>
  apiClient.post<CommissionPaymentDetail>(`/owner/commission/payments/${id}/cancelled`, {});
export const ownerFinanceSummary = (id: string) =>
  apiClient.get<OwnerFinancePage>(`/owner/lodges/${id}/finance/summary`);
export const revenueSettlement = (id: string, settlementId: string, page = 1, limit = 30) =>
  apiClient.get<RevenueSettlementDetail>(
    `/owner/lodges/${id}/finance/settlements/${settlementId}`,
    { params: { page, limit } },
  );
export const exportRevenueSettlement = (id: string, settlementId: string, format: string) =>
  apiClient.get<{ filename: string; base64: string; mimeType: string }>(
    `/owner/lodges/${id}/finance/settlements/${settlementId}/export`,
    { params: { format } },
  );
export const commissionReceipt = (id: string) =>
  apiClient.get<{ filename: string; base64: string }>(`/owner/commission/payments/${id}/receipt`);
export const exportFinance = (id: string, params: FinanceFilters) =>
  apiClient.get<{ filename: string; base64: string; mimeType: string }>(
    `/owner/lodges/${id}/finance/export`,
    { params, timeout: 120_000 },
  );
