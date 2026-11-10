import { apiClient } from './client';

export interface RefundRow {
  id: string;
  reference: string;
  bookingId: string;
  bookingReference: string;
  bookingStatus?: string;
  paymentStatus?: string;
  pilgrimName: string;
  pilgrimUserId: string;
  lodgeName: string;
  cancellationReason: string;
  originalPaymentId: string | null;
  originalAmountPaise: number;
  capturedAmountPaise: number | null;
  amountPaise: number | null;
  status: string;
  failureReason: string | null;
  cancellationDate: string | null;
  initiatedAt: string | null;
  processedAt: string | null;
  cancellationDetails: unknown;
  cancelledByUserId: string | null;
  history: Array<{
    id: string;
    receipt: string;
    providerRefundId: string | null;
    amount: number;
    status: string;
    speed: string;
    createdAt: string;
    failureReason: string | null;
  }>;
}
export interface RefundPage {
  items: RefundRow[];
  totalItems: number;
  page: number;
  pageSize: number;
  summary: Array<{ status: string; count: number; amountPaise: number }>;
}
export interface RefundDetail extends RefundRow {
  audits: Array<{ id: string; action: string; createdAt: string; actorUserId: string | null }>;
  events: Array<{
    id: string;
    eventType: string;
    processedAt: string | null;
    lastError: string | null;
  }>;
}
export function listRefunds(page: number, search = '', status = '') {
  return apiClient.get<RefundPage>('/admin/finance/refunds', { params: { page, search, status } });
}
export function getRefund(id: string) {
  return apiClient.get<RefundDetail>(`/admin/finance/refunds/${id}`);
}
export function refundAction(id: string, action: 'retry' | 'reconcile') {
  return apiClient.post<RefundDetail>(`/admin/finance/refunds/${id}/${action}`, {});
}

export function cancelAdminBooking(
  id: string,
  input: {
    reason: string;
    deductionPaise?: number;
    supportTicketId?: string;
    deductionReason?: string;
  },
) {
  return apiClient.post(`/admin/bookings/${id}/cancel`, { ...input, confirmed: true });
}
