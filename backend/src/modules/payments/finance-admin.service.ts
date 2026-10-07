import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminPaymentRow,
  AdminPaymentsPage,
  AdminPaymentStatusCount,
  AdminSettlementHistoryPage,
  AdminSettlementHistoryRow,
  PaymentCollectionMethod,
  PaymentCollectionStatus,
} from '@tuljai/types';

import { PrismaService } from '../prisma/prisma.service';

export const PAYMENT_STATUSES: PaymentCollectionStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'CANCELLED',
];
export const PAYMENT_METHODS: PaymentCollectionMethod[] = ['ONLINE', 'PAY_AT_LODGE'];

interface PaymentDbRow {
  amount: string;
  bookingCode: string;
  bookingId: string;
  createdAt: Date;
  guestName: string;
  id: string;
  lodgeName: string;
  method: PaymentCollectionMethod;
  paidAt: Date | null;
  provider: string | null;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: PaymentCollectionStatus;
}

interface StatusCountDbRow {
  amount: string;
  count: number;
  status: PaymentCollectionStatus;
}

interface SettlementDbRow {
  amount: string;
  id: string;
  lodgeId: string;
  lodgeName: string;
  notes: string | null;
  paymentMethod: string;
  reference: string | null;
  settledAt: Date;
  settledByName: string | null;
}

@Injectable()
export class FinanceAdminService {
  public constructor(private readonly prisma: PrismaService) {}

  /** Payment collections (online Razorpay and pay-at-lodge) with booking and lodge context. */
  public async listPayments(input: {
    method?: PaymentCollectionMethod;
    page: number;
    pageSize: number;
    search?: string;
    status?: PaymentCollectionStatus;
  }): Promise<AdminPaymentsPage> {
    const base: Prisma.Sql[] = [];
    if (input.method) base.push(Prisma.sql`pc.method = ${input.method}`);
    if (input.search) {
      const like = `%${input.search}%`;
      base.push(
        Prisma.sql`(b.booking_code ILIKE ${like} OR b.guest_name ILIKE ${like} OR pc.provider_payment_id ILIKE ${like} OR pc.provider_order_id ILIKE ${like})`,
      );
    }
    const filtered = input.status ? [...base, Prisma.sql`pc.status = ${input.status}`] : base;
    const whereBase = base.length ? Prisma.sql`WHERE ${Prisma.join(base, ' AND ')}` : Prisma.empty;
    const whereFiltered = filtered.length
      ? Prisma.sql`WHERE ${Prisma.join(filtered, ' AND ')}`
      : Prisma.empty;
    const offset = (input.page - 1) * input.pageSize;

    const [rows, totals, counts] = await Promise.all([
      this.prisma.$queryRaw<PaymentDbRow[]>(Prisma.sql`
        SELECT
          pc.id,
          pc.booking_id AS "bookingId",
          b.booking_code AS "bookingCode",
          b.guest_name AS "guestName",
          l.name AS "lodgeName",
          pc.method,
          pc.provider,
          pc.amount::text AS amount,
          pc.status,
          pc.provider_order_id AS "providerOrderId",
          pc.provider_payment_id AS "providerPaymentId",
          pc.paid_at AS "paidAt",
          pc.created_at AS "createdAt"
        FROM payment_collections pc
        INNER JOIN bookings b ON b.id = pc.booking_id
        INNER JOIN lodges l ON l.id = b.lodge_id
        ${whereFiltered}
        ORDER BY pc.created_at DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `),
      this.prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM payment_collections pc
        INNER JOIN bookings b ON b.id = pc.booking_id
        ${whereFiltered}
      `),
      this.prisma.$queryRaw<StatusCountDbRow[]>(Prisma.sql`
        SELECT pc.status, COUNT(*)::int AS count, COALESCE(SUM(pc.amount), 0)::text AS amount
        FROM payment_collections pc
        INNER JOIN bookings b ON b.id = pc.booking_id
        ${whereBase}
        GROUP BY pc.status
      `),
    ]);

    const totalItems = totals[0]?.total ?? 0;
    const statusCounts: AdminPaymentStatusCount[] = PAYMENT_STATUSES.map((status) => {
      const found = counts.find((row) => row.status === status);
      return { amount: found?.amount ?? '0', count: found?.count ?? 0, status };
    });
    return {
      items: rows.map(
        (row): AdminPaymentRow => ({
          amount: row.amount,
          bookingCode: row.bookingCode,
          bookingId: row.bookingId,
          createdAt: row.createdAt.toISOString(),
          guestName: row.guestName,
          id: row.id,
          lodgeName: row.lodgeName,
          method: row.method,
          paidAt: row.paidAt ? row.paidAt.toISOString() : null,
          provider: row.provider,
          providerOrderId: row.providerOrderId,
          providerPaymentId: row.providerPaymentId,
          status: row.status,
        }),
      ),
      page: input.page,
      pageSize: input.pageSize,
      statusCounts,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / input.pageSize)),
    };
  }

  /** Every commission settlement ever recorded, newest first (existing lodge commission ledger). */
  public async settlementHistory(input: {
    page: number;
    pageSize: number;
  }): Promise<AdminSettlementHistoryPage> {
    const offset = (input.page - 1) * input.pageSize;
    const [rows, totals] = await Promise.all([
      this.prisma.$queryRaw<SettlementDbRow[]>(Prisma.sql`
        SELECT
          s.id,
          s.lodge_id AS "lodgeId",
          l.name AS "lodgeName",
          s.amount::text AS amount,
          s.payment_method AS "paymentMethod",
          s.reference,
          s.notes,
          s.settled_at AS "settledAt",
          u.display_name AS "settledByName"
        FROM lodge_commission_settlements s
        INNER JOIN lodges l ON l.id = s.lodge_id
        LEFT JOIN users u ON u.id = s.settled_by_user_id
        ORDER BY s.settled_at DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `),
      this.prisma.$queryRaw<Array<{ settledTotal: string; total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total, COALESCE(SUM(amount), 0)::text AS "settledTotal"
        FROM lodge_commission_settlements
      `),
    ]);
    const totalItems = totals[0]?.total ?? 0;
    return {
      items: rows.map(
        (row): AdminSettlementHistoryRow => ({
          amount: row.amount,
          id: row.id,
          lodgeId: row.lodgeId,
          lodgeName: row.lodgeName,
          notes: row.notes,
          paymentMethod: row.paymentMethod,
          reference: row.reference,
          settledAt: row.settledAt.toISOString(),
          settledByName: row.settledByName,
        }),
      ),
      page: input.page,
      pageSize: input.pageSize,
      settledTotal: totals[0]?.settledTotal ?? '0',
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / input.pageSize)),
    };
  }
}
