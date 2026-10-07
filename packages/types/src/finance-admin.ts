import type { ISODateTime, UUID } from './common';

export type PaymentCollectionStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type PaymentCollectionMethod = 'ONLINE' | 'PAY_AT_LODGE';

export interface AdminPaymentRow {
  amount: string;
  bookingCode: string;
  bookingId: UUID;
  createdAt: ISODateTime;
  guestName: string;
  id: UUID;
  lodgeName: string;
  method: PaymentCollectionMethod;
  paidAt: ISODateTime | null;
  provider: string | null;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: PaymentCollectionStatus;
}

export interface AdminPaymentStatusCount {
  amount: string;
  count: number;
  status: PaymentCollectionStatus;
}

/** Payment collections joined to their booking and lodge. Counts ignore the status filter. */
export interface AdminPaymentsPage {
  items: AdminPaymentRow[];
  page: number;
  pageSize: number;
  statusCounts: AdminPaymentStatusCount[];
  totalItems: number;
  totalPages: number;
}

export interface AdminSettlementHistoryRow {
  amount: string;
  id: UUID;
  lodgeId: UUID;
  lodgeName: string;
  notes: string | null;
  paymentMethod: string;
  reference: string | null;
  settledAt: ISODateTime;
  settledByName: string | null;
}

export interface AdminSettlementHistoryPage {
  items: AdminSettlementHistoryRow[];
  page: number;
  pageSize: number;
  settledTotal: string;
  totalItems: number;
  totalPages: number;
}
