import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AuthenticatedUser,
  CommissionHistoryPage,
  CommissionPaymentRecord,
  OwnerFinancePage,
  RevenueSettlementDetail,
} from '@tuljai/types';

import { PrismaService } from '../prisma/prisma.service';

import {
  commissionPaymentSelect,
  dueCommission,
  offlineCommission,
  onlineCommission,
} from './commission-payment.service';
import { LodgeAccessService } from './lodge-access.service';
import type { FinanceQuery } from './owner-finance.controller';

export function financeRange(query: { startDate?: string; endDate?: string }) {
  for (const value of [query.startDate, query.endDate]) {
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      throw new BadRequestException('Use valid YYYY-MM-DD dates');
  }
  if (query.startDate && query.endDate && query.startDate > query.endDate)
    throw new BadRequestException('Invalid date range');
  const start = query.startDate
    ? new Date(`${query.startDate}T00:00:00+05:30`)
    : new Date('2000-01-01');
  const end = query.endDate
    ? new Date(new Date(`${query.endDate}T00:00:00+05:30`).getTime() + 86400000)
    : new Date('2100-01-01');
  return { start, end };
}

@Injectable()
export class OwnerFinanceService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly access: LodgeAccessService,
  ) {}

  public async ownerPayments(lodgeId: string, user: AuthenticatedUser, page = 1, limit = 30) {
    await this.access.assertCanManageLodge(user, lodgeId);
    const [items, count] = await Promise.all([
      this.prisma.$queryRaw<CommissionPaymentRecord[]>(
        Prisma.sql`${commissionPaymentSelect} WHERE p.lodge_id=${lodgeId}::uuid ORDER BY COALESCE(p.verified_at,p.created_at) DESC,p.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      ),
      this.prisma.$queryRaw<
        { count: number }[]
      >`SELECT COUNT(*)::integer AS count FROM commission_payments WHERE lodge_id=${lodgeId}::uuid`,
    ]);
    return { items, totalItems: count[0]!.count, page };
  }

  public async outstandingExportRows() {
    return this.prisma.$queryRaw<
      { ownerId: string; owner: string; lodge: string; amount: string; bookings: number }[]
    >(Prisma.sql`
      SELECT COALESCE(lo.owner_user_id,(SELECT user_id FROM lodge_owners WHERE lodge_id=lo.id AND is_active AND deleted_at IS NULL ORDER BY created_at LIMIT 1))::text AS "ownerId",
        COALESCE(u.display_name,'Owner') AS owner,lo.name AS lodge,SUM(${dueCommission})::text AS amount,COUNT(*)::integer AS bookings
      FROM lodge_commission_ledger l JOIN bookings b ON b.id=l.booking_id JOIN lodges lo ON lo.id=l.lodge_id
      LEFT JOIN users u ON u.id=COALESCE(lo.owner_user_id,(SELECT user_id FROM lodge_owners WHERE lodge_id=lo.id AND is_active AND deleted_at IS NULL ORDER BY created_at LIMIT 1))
      WHERE l.status='OUTSTANDING' AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text) AND ${offlineCommission} AND ${dueCommission}>0
      GROUP BY lo.id,u.display_name ORDER BY lo.name`);
  }

  public async dailyExportRows(query: FinanceQuery) {
    const { start, end } = financeRange(query);
    return this.prisma.$queryRaw<
      { date: string; amount: string; payments: number }[]
    >`SELECT to_char(verified_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS date,
      (SUM(amount_paise)/100.0)::text AS amount,COUNT(*)::integer AS payments FROM commission_payments WHERE status='SUCCESSFUL' AND verified_at>=${start} AND verified_at<${end}
      AND (${query.lodgeId ?? ''}='' OR lodge_id::text=${query.lodgeId ?? ''}) AND (${query.ownerId ?? ''}='' OR owner_id::text=${query.ownerId ?? ''}) GROUP BY date ORDER BY date DESC`;
  }

  public async settlement(
    lodgeId: string,
    id: string,
    user: AuthenticatedUser,
    page = 1,
    limit = 30,
  ): Promise<RevenueSettlementDetail> {
    await this.access.assertCanManageLodge(user, lodgeId);
    const records = await this.prisma.$queryRaw<
      Omit<RevenueSettlementDetail, 'bookings' | 'totalItems' | 'page'>[]
    >`SELECT id,amount::text,commission_deducted::text AS "commissionDeducted",reference,
      to_char(settled_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "settledAt",payment_method AS "paymentMethod",bank_name AS "bankName",account_last4 AS "accountLast4" FROM lodge_revenue_settlements WHERE id=${id}::uuid AND lodge_id=${lodgeId}::uuid`;
    if (!records[0]) throw new BadRequestException('Revenue settlement not found');
    const [bookings, counts] = await Promise.all([
      this.prisma.$queryRaw<
        RevenueSettlementDetail['bookings']
      >`SELECT b.id AS "bookingId",b.booking_code AS "bookingCode",a.amount::text AS commission
        FROM lodge_revenue_settlements r JOIN lodge_commission_settlement_allocations a ON a.settlement_id=r.commission_settlement_id
        JOIN lodge_commission_ledger l ON l.id=a.ledger_id JOIN bookings b ON b.id=l.booking_id WHERE r.id=${id}::uuid ORDER BY b.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      this.prisma.$queryRaw<
        { count: number }[]
      >`SELECT COUNT(*)::integer AS count FROM lodge_revenue_settlements r JOIN lodge_commission_settlement_allocations a ON a.settlement_id=r.commission_settlement_id WHERE r.id=${id}::uuid`,
    ]);
    return { ...records[0], bookings, totalItems: counts[0]!.count, page };
  }

  public async owner(
    lodgeId: string,
    user: AuthenticatedUser,
    query: FinanceQuery,
    summaryOnly = false,
  ): Promise<OwnerFinancePage> {
    await this.access.assertCanManageLodge(user, lodgeId);
    const { start, end } = financeRange(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const where = Prisma.sql`b.lodge_id=${lodgeId}::uuid AND b.deleted_at IS NULL AND b.created_at>=${start} AND b.created_at<${end}`;
    // Existing eligibility function remains authoritative; cancelled/failed amounts never become revenue.
    const eligible = Prisma.sql`public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text)`;
    const revenue = Prisma.sql`CASE WHEN ${eligible} THEN COALESCE(b.total_amount,0) ELSE 0 END`;
    const commission = Prisma.sql`CASE WHEN ${eligible} AND l.status<>'VOIDED' THEN l.commission_amount ELSE 0 END`;
    const [lodge, days, summary, bookings, balance, payments, settlements, paymentCounts] =
      await Promise.all([
        this.prisma.lodge.findUniqueOrThrow({ where: { id: lodgeId }, select: { name: true } }),
        summaryOnly
          ? Promise.resolve([])
          : this.prisma.$queryRaw<
              OwnerFinancePage['days']
            >(Prisma.sql`SELECT to_char(b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS date,
        COUNT(*)::integer AS bookings, SUM(${revenue})::text AS revenue, COALESCE(SUM(${commission}),0)::text AS commission
        FROM bookings b LEFT JOIN lodge_commission_ledger l ON l.booking_id=b.id WHERE ${where}
        GROUP BY date ORDER BY date DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
        this.prisma.$queryRaw<
          OwnerFinancePage['summary'][]
        >(Prisma.sql`SELECT COUNT(*)::integer AS bookings, COALESCE(SUM(${revenue}),0)::text AS revenue,
        COALESCE(SUM(${commission}),0)::text AS commission,
        COALESCE(SUM((SELECT COALESCE(SUM(pc.amount),0) FROM payment_collections pc WHERE pc.booking_id=b.id AND pc.status='PAID' AND pc.method='ONLINE')) FILTER (WHERE ${eligible}),0)::text AS "onlineReceived",
        COALESCE(SUM((SELECT COALESCE(SUM(pc.amount),0) FROM payment_collections pc WHERE pc.booking_id=b.id AND pc.status='PAID' AND pc.method<>'ONLINE')) FILTER (WHERE ${eligible}),0)::text AS "offlineReceived"
        FROM bookings b LEFT JOIN lodge_commission_ledger l ON l.booking_id=b.id WHERE ${where}`),
        summaryOnly
          ? Promise.resolve([])
          : this.prisma.$queryRaw<
              OwnerFinancePage['bookings']
            >(Prisma.sql`SELECT b.id, b.booking_code AS "bookingCode", b.guest_name AS "guestName",
        to_char(b.created_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt", b.payment_status::text AS "paymentStatus", b.status::text,
        COALESCE(b.total_amount,0)::text AS amount, (${revenue})::text AS revenue, COALESCE(${commission},0)::text AS commission,
        (CASE WHEN ${eligible} THEN COALESCE((SELECT SUM(pc.amount) FROM payment_collections pc WHERE pc.booking_id=b.id AND pc.status='PAID'),0) ELSE 0 END)::text AS "receivedAmount",
        COALESCE(l.commission_rate_percent,0)::text AS rate,
        (SELECT COALESCE(p.thumbnail_url,p.file_url) FROM lodge_photos p WHERE p.lodge_id=b.lodge_id AND p.deleted_at IS NULL AND p.approval_status='APPROVED'
          ORDER BY (p.room_id=b.room_id) DESC NULLS LAST,p.is_cover DESC,p.sort_order LIMIT 1) AS thumbnail
        FROM bookings b LEFT JOIN lodge_commission_ledger l ON l.booking_id=b.id WHERE ${where} ORDER BY b.created_at DESC,b.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
        this.prisma.$queryRaw<OwnerFinancePage['balance'][]>(Prisma.sql`SELECT
        COALESCE(SUM(${dueCommission}) FILTER (WHERE ${offlineCommission}),0)::text AS payable,
        COUNT(*) FILTER (WHERE ${offlineCommission} AND ${dueCommission}>0)::integer AS bookings,
        COALESCE(SUM(${dueCommission}) FILTER (WHERE ${offlineCommission} AND l.eligible_at<date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'),0)::text AS "previousBalance",
        to_char(now() AT TIME ZONE 'Asia/Kolkata','Mon YYYY') AS period,
        (SELECT COALESCE(SUM(commission_deducted),0)::text FROM lodge_revenue_settlements WHERE lodge_id=${lodgeId}::uuid) AS deducted,
        (SELECT COALESCE(SUM(amount),0)::text FROM lodge_commission_settlements WHERE lodge_id=${lodgeId}::uuid AND payment_method<>'REVENUE_OFFSET') AS paid,
        (SELECT to_char(MAX(settled_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM lodge_commission_settlements WHERE lodge_id=${lodgeId}::uuid AND payment_method<>'REVENUE_OFFSET') AS "lastPaymentAt",
        (SELECT COALESCE(SUM(amount),0)::text FROM lodge_revenue_settlements WHERE lodge_id=${lodgeId}::uuid) AS "ownerReceived",
        GREATEST((SELECT COALESCE(SUM(pc.amount),0) FROM payment_collections pc JOIN bookings rb ON rb.id=pc.booking_id
          WHERE rb.lodge_id=${lodgeId}::uuid AND rb.deleted_at IS NULL AND public.tuljai_commission_is_eligible(rb.status::text,rb.payment_status::text) AND pc.method='ONLINE' AND pc.status='PAID')
          - COALESCE(SUM(${dueCommission}) FILTER (WHERE ${onlineCommission}),0)
          - (SELECT COALESCE(SUM(amount+commission_deducted),0) FROM lodge_revenue_settlements WHERE lodge_id=${lodgeId}::uuid),0)::text AS "ownerPayable"
        FROM lodge_commission_ledger l JOIN bookings b ON b.id=l.booking_id WHERE l.lodge_id=${lodgeId}::uuid AND l.status<>'VOIDED'
          AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text)`),
        summaryOnly
          ? Promise.resolve([])
          : this.prisma.$queryRaw<CommissionPaymentRecord[]>(
              Prisma.sql`${commissionPaymentSelect} WHERE p.lodge_id=${lodgeId}::uuid ORDER BY p.created_at DESC LIMIT 30`,
            ),
        summaryOnly
          ? Promise.resolve([])
          : this.prisma.$queryRaw<
              OwnerFinancePage['settlements']
            >(Prisma.sql`SELECT id, amount::text,reference,to_char(settled_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "settledAt",payment_method AS "paymentMethod",commission_deducted::text AS "commissionDeducted"
        FROM lodge_revenue_settlements WHERE lodge_id=${lodgeId}::uuid ORDER BY settled_at DESC LIMIT 30`),
        summaryOnly
          ? Promise.resolve([{ count: 0 }])
          : this.prisma.$queryRaw<
              { count: number }[]
            >`SELECT COUNT(*)::integer AS count FROM commission_payments WHERE lodge_id=${lodgeId}::uuid`,
      ]);
    const count =
      query.day || summaryOnly
        ? summary[0]!.bookings
        : await this.prisma
            .$queryRaw<{ count: number }[]>(
              Prisma.sql`SELECT COUNT(DISTINCT (b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date)::integer AS count FROM bookings b WHERE ${where}`,
            )
            .then((r) => r[0]!.count);
    return {
      lodgeName: lodge.name,
      days,
      bookings,
      summary: summary[0]!,
      balance: balance[0]!,
      payments,
      paymentTotalItems: paymentCounts[0]!.count,
      settlements,
      page,
      totalItems: count,
    };
  }

  public async history(query: FinanceQuery): Promise<CommissionHistoryPage> {
    const { start, end } = financeRange(query);
    const page = query.page ?? 1,
      limit = query.limit ?? 30;
    const search = `%${query.search ?? ''}%`;
    const where = Prisma.sql`COALESCE(p.verified_at,p.created_at)>=${start} AND COALESCE(p.verified_at,p.created_at)<${end}
      AND (${query.status ?? ''}='' OR p.status=${query.status ?? ''})
      AND (${query.ownerId ?? ''}='' OR p.owner_id::text=${query.ownerId ?? ''})
      AND (${query.lodgeId ?? ''}='' OR p.lodge_id::text=${query.lodgeId ?? ''})
      AND (COALESCE(u.display_name,'') ILIKE ${search} OR lo.name ILIKE ${search} OR p.id::text ILIKE ${search} OR p.order_id ILIKE ${search} OR p.payment_id ILIKE ${search})`;
    const [items, counts, summary] = await Promise.all([
      this.prisma.$queryRaw<CommissionPaymentRecord[]>(
        Prisma.sql`${commissionPaymentSelect} WHERE ${where} ORDER BY ${query.sort === 'amount' ? Prisma.sql`p.amount_paise` : Prisma.sql`COALESCE(p.verified_at,p.created_at)`} ${query.direction === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`},p.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      ),
      this.prisma.$queryRaw<{ count: number }[]>(
        Prisma.sql`SELECT COUNT(*)::integer AS count FROM commission_payments p JOIN users u ON u.id=p.owner_id JOIN lodges lo ON lo.id=p.lodge_id WHERE ${where}`,
      ),
      this.prisma.$queryRaw<
        CommissionHistoryPage['summary'][]
      >(Prisma.sql`SELECT COALESCE(SUM(p.amount_paise) FILTER (WHERE p.status='SUCCESSFUL'),0)::float8 AS "receivedPaise",
        COUNT(*) FILTER (WHERE p.status='SUCCESSFUL')::integer AS "receivedCount",
        (SELECT COALESCE(SUM(${dueCommission}),0)::text FROM lodge_commission_ledger l JOIN bookings b ON b.id=l.booking_id WHERE l.status='OUTSTANDING' AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text) AND ${offlineCommission}) AS pending,
        (SELECT COUNT(DISTINCT COALESCE(lo.owner_user_id,(SELECT user_id FROM lodge_owners WHERE lodge_id=lo.id AND is_active AND deleted_at IS NULL ORDER BY created_at LIMIT 1)))::integer FROM lodge_commission_ledger l JOIN bookings b ON b.id=l.booking_id JOIN lodges lo ON lo.id=l.lodge_id WHERE l.status='OUTSTANDING' AND ${dueCommission}>0 AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text) AND ${offlineCommission}) AS owners
        FROM commission_payments p JOIN users u ON u.id=p.owner_id JOIN lodges lo ON lo.id=p.lodge_id WHERE ${where}`),
    ]);
    return { items, totalItems: counts[0]!.count, page, summary: summary[0]! };
  }
}
