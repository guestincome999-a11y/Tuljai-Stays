import type {
  AdminPaymentsPage,
  AdminSettlementHistoryPage,
  PaymentCollectionMethod,
  PaymentCollectionStatus,
} from '@tuljai/types';

import { apiClient } from './client';

export async function listAdminPayments(input: {
  method?: PaymentCollectionMethod;
  page: number;
  search?: string;
  status?: PaymentCollectionStatus;
}): Promise<AdminPaymentsPage> {
  return apiClient.get<AdminPaymentsPage>('/admin/finance/payments', {
    params: {
      method: input.method,
      page: input.page,
      pageSize: 20,
      search: input.search || undefined,
      status: input.status,
    },
  });
}

export async function listSettlementHistory(page: number): Promise<AdminSettlementHistoryPage> {
  return apiClient.get<AdminSettlementHistoryPage>('/admin/finance/settlements/history', {
    params: { page, pageSize: 15 },
  });
}
