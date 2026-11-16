export interface FinanceBooking {
  id: string;
  bookingCode: string;
  guestName: string;
  createdAt: string;
  paymentStatus: string;
  status: string;
  amount: string;
  revenue: string;
  /** Verified, eligible payment collections; never inferred from booking value. */
  receivedAmount?: string;
  commission: string;
  rate: string;
  thumbnail: string | null;
}
export interface OwnerFinancePage {
  lodgeName: string;
  days: { date: string; bookings: number; revenue: string; commission: string }[];
  bookings: FinanceBooking[];
  totalItems: number;
  page: number;
  summary: {
    bookings: number;
    revenue: string;
    commission: string;
    onlineReceived: string;
    offlineReceived: string;
  };
  balance: {
    payable: string;
    bookings: number;
    previousBalance: string;
    period: string;
    deducted: string;
    paid: string;
    lastPaymentAt: string | null;
    ownerReceived: string;
    ownerPayable: string;
  };
  payments: CommissionPaymentRecord[];
  paymentTotalItems: number;
  settlements: {
    id: string;
    amount: string;
    reference: string | null;
    settledAt: string;
    paymentMethod: string;
    commissionDeducted: string;
  }[];
}
export interface CommissionPaymentRecord {
  id: string;
  ownerId: string;
  ownerName: string;
  lodgeId: string;
  lodgeName: string;
  amountPaise: number;
  paymentType: 'FULL' | 'PARTIAL';
  outstandingBeforePaise: number | null;
  remainingAfterPaise: number | null;
  currentOutstandingPaise: number;
  currency: string;
  status: string;
  orderId: string | null;
  paymentId: string | null;
  method: string | null;
  verifiedAt: string | null;
  createdAt: string;
  settlementId: string | null;
  lastCheckedAt: string | null;
  webhookAt: string | null;
  keyId?: string;
}
export interface CommissionPaymentDetail extends CommissionPaymentRecord {
  bookings: {
    ledgerId: string;
    bookingId: string;
    bookingCode: string;
    amountPaise: number;
    dueBeforePaise: number;
    commissionPaise: number;
    totalPaidPaise: number;
    remainingPaise: number;
  }[];
}
export interface CommissionHistoryPage {
  items: CommissionPaymentRecord[];
  totalItems: number;
  page: number;
  summary: { receivedPaise: number; receivedCount: number; pending: string; owners: number };
}
export interface RevenueSettlementDetail {
  id: string;
  amount: string;
  commissionDeducted: string;
  reference: string | null;
  settledAt: string;
  paymentMethod: string;
  bankName: string | null;
  accountLast4: string | null;
  bookings: { bookingId: string; bookingCode: string; commission: string }[];
  totalItems: number;
  page: number;
}
