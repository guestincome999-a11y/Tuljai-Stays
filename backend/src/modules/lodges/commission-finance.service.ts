import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AuthenticatedUser,
  LodgeCommissionFinanceReport,
  LodgeCommissionSettlement,
  LodgeCommissionTransaction,
  LodgeRevenueSummary,
} from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import { CreateCommissionSettlementDto } from './dto/commission-settlement.dto';
import { CreateRevenueSettlementDto } from './dto/revenue-settlement.dto';
import { LodgeAccessService } from './lodge-access.service';

/** Money is kept to 2 decimals so repeated float arithmetic can never leave sub-paisa residue. */
const toMoney = (value: number): number => Math.round(value * 100) / 100;

@Injectable()
export class LodgeCommissionFinanceService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly lodgeAccessService: LodgeAccessService,
    private readonly prisma: PrismaService,
  ) {}

  public async getReport(
    lodgeId: string,
    user?: AuthenticatedUser,
  ): Promise<LodgeCommissionFinanceReport> {
    if (user && !this.lodgeAccessService.isAdmin(user)) {
      await this.lodgeAccessService.assertCanManageLodge(user, lodgeId);
    } else {
      await this.assertLodge(lodgeId);
    }

    const [
      lodgeRows,
      settingRows,
      transactionRows,
      settlementRows,
      summaryRows,
      revenue,
      revenueSettlements,
    ] = await Promise.all([
      this.prisma.$queryRaw<Array<{ id: string; name: string }>>(Prisma.sql`
          SELECT id, name FROM lodges WHERE id = ${lodgeId}::uuid AND deleted_at IS NULL LIMIT 1
        `),
      this.prisma.$queryRaw<
        Array<{
          commissionEnabled: boolean;
          commissionFixedAmount: string;
          commissionRatePercent: string;
          commissionType: 'PERCENTAGE' | 'FIXED_PER_BOOKING';
          effectiveFrom: string;
        }>
      >(Prisma.sql`
          SELECT
            commission_enabled AS "commissionEnabled",
            commission_fixed_amount::text AS "commissionFixedAmount",
            commission_rate_percent::text AS "commissionRatePercent",
            commission_type AS "commissionType",
            effective_from::text AS "effectiveFrom"
          FROM lodge_commission_settings
          WHERE lodge_id = ${lodgeId}::uuid
          LIMIT 1
        `),
      this.prisma.$queryRaw<LodgeCommissionTransaction[]>(Prisma.sql`
          SELECT
            l.id,
            l.booking_id AS "bookingId",
            b.booking_code AS "bookingCode",
            COALESCE(b.total_amount, 0)::text AS "baseAmount",
            l.commission_type AS "commissionType",
            l.commission_rate_percent::text AS "commissionRatePercent",
            l.commission_fixed_amount::text AS "commissionFixedAmount",
            l.commission_amount::text AS "commissionAmount",
            COALESCE(a.allocated_amount, 0)::text AS "allocatedAmount",
            GREATEST(l.commission_amount - COALESCE(a.allocated_amount, 0), 0)::text AS "outstandingAmount",
            l.status,
            l.eligible_at::text AS "eligibleAt",
            l.settled_at::text AS "settledAt",
            l.voided_at::text AS "voidedAt",
            l.notes,
            b.check_in_date::text AS "checkInDate",
            b.check_out_date::text AS "checkOutDate"
          FROM lodge_commission_ledger l
          INNER JOIN bookings b ON b.id = l.booking_id
          LEFT JOIN (
            SELECT ledger_id, SUM(amount) AS allocated_amount
            FROM lodge_commission_settlement_allocations
            GROUP BY ledger_id
          ) a ON a.ledger_id = l.id
          WHERE l.lodge_id = ${lodgeId}::uuid
          ORDER BY l.created_at DESC
        `),
      this.prisma.$queryRaw<LodgeCommissionSettlement[]>(Prisma.sql`
          SELECT
            id,
            amount::text AS amount,
            payment_method AS "paymentMethod",
            reference,
            notes,
            settled_by_user_id AS "settledByUserId",
            settled_at::text AS "settledAt",
            created_at::text AS "createdAt"
          FROM lodge_commission_settlements
          WHERE lodge_id = ${lodgeId}::uuid
          ORDER BY settled_at DESC
        `),
      this.prisma.$queryRaw<
        Array<{
          bookingRevenue: string;
          commissionReceivable: string;
          outstanding: string;
          settled: string;
          voided: string;
          totalSettlements: string;
        }>
      >(Prisma.sql`
          SELECT
            COALESCE((SELECT SUM(total_amount) FROM bookings WHERE lodge_id = ${lodgeId}::uuid AND deleted_at IS NULL AND public.tuljai_commission_is_eligible(status::text,payment_status::text)), 0)::text AS "bookingRevenue",
            COALESCE((SELECT SUM(commission_amount) FROM lodge_commission_ledger led WHERE lodge_id = ${lodgeId}::uuid AND status <> 'VOIDED' AND EXISTS (SELECT 1 FROM bookings b WHERE b.id=led.booking_id AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text))), 0)::text AS "commissionReceivable",
            COALESCE((
              SELECT SUM(GREATEST(l.commission_amount - COALESCE(a.allocated_amount, 0), 0))
              FROM lodge_commission_ledger l
              LEFT JOIN (
                SELECT ledger_id, SUM(amount) AS allocated_amount
                FROM lodge_commission_settlement_allocations
                GROUP BY ledger_id
              ) a ON a.ledger_id = l.id
              WHERE l.lodge_id = ${lodgeId}::uuid AND l.status <> 'VOIDED'
                AND EXISTS (SELECT 1 FROM bookings b WHERE b.id=l.booking_id AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text))
            ), 0)::text AS outstanding,
            COALESCE((
              SELECT SUM(a.amount)
              FROM lodge_commission_settlement_allocations a
              INNER JOIN lodge_commission_ledger l ON l.id = a.ledger_id
              WHERE l.lodge_id = ${lodgeId}::uuid AND l.status <> 'VOIDED'
            ), 0)::text AS settled,
            COALESCE((SELECT SUM(commission_amount) FROM lodge_commission_ledger WHERE lodge_id = ${lodgeId}::uuid AND status = 'VOIDED'), 0)::text AS voided,
            COALESCE((SELECT SUM(amount) FROM lodge_commission_settlements WHERE lodge_id = ${lodgeId}::uuid), 0)::text AS "totalSettlements"
        `),
      this.getRevenueSummary(lodgeId, this.prisma),
      this.prisma.$queryRaw<LodgeCommissionSettlement[]>(Prisma.sql`
          SELECT id, amount::text, payment_method AS "paymentMethod", reference, notes,
            settled_by_user_id AS "settledByUserId", settled_at::text AS "settledAt",
            created_at::text AS "createdAt"
          FROM lodge_revenue_settlements WHERE lodge_id = ${lodgeId}::uuid
          ORDER BY settled_at DESC, id DESC
        `),
    ]);

    const lodge = lodgeRows[0];
    if (!lodge) throw new NotFoundException('Lodge not found');

    return {
      lodgeId: lodge.id,
      lodgeName: lodge.name,
      revenue,
      revenueSettlements,
      setting: settingRows[0] ?? {
        commissionEnabled: false,
        commissionFixedAmount: '0',
        commissionRatePercent: '0',
        commissionType: 'PERCENTAGE',
        effectiveFrom: new Date().toISOString(),
      },
      summary: summaryRows[0] ?? {
        bookingRevenue: '0',
        commissionReceivable: '0',
        outstanding: '0',
        settled: '0',
        voided: '0',
        totalSettlements: '0',
      },
      transactions: transactionRows,
      settlements: settlementRows,
    };
  }

  public listOverview(): Promise<
    Array<{
      commissionEnabled: boolean;
      commissionFixedAmount: string;
      commissionRatePercent: string;
      commissionType: 'PERCENTAGE' | 'FIXED_PER_BOOKING';
      lodgeId: string;
      lodgeName: string;
      outstanding: string;
      receivable: string;
      settled: string;
    }>
  > {
    return this.prisma.$queryRaw(Prisma.sql`
      SELECT
        l.id AS "lodgeId",
        l.name AS "lodgeName",
        COALESCE(s.commission_enabled, false) AS "commissionEnabled",
        COALESCE(s.commission_type, 'PERCENTAGE') AS "commissionType",
        COALESCE(s.commission_rate_percent, 0)::text AS "commissionRatePercent",
        COALESCE(s.commission_fixed_amount, 0)::text AS "commissionFixedAmount",
        COALESCE((
          SELECT SUM(led.commission_amount)
          FROM lodge_commission_ledger led
          WHERE led.lodge_id = l.id AND led.status <> 'VOIDED'
            AND EXISTS (SELECT 1 FROM bookings b WHERE b.id=led.booking_id AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text))
        ), 0)::text AS receivable,
        COALESCE((
          SELECT SUM(GREATEST(led.commission_amount - COALESCE(alloc.allocated_amount, 0), 0))
          FROM lodge_commission_ledger led
          LEFT JOIN (
            SELECT ledger_id, SUM(amount) AS allocated_amount
            FROM lodge_commission_settlement_allocations
            GROUP BY ledger_id
          ) alloc ON alloc.ledger_id = led.id
          WHERE led.lodge_id = l.id AND led.status <> 'VOIDED'
            AND EXISTS (SELECT 1 FROM bookings b WHERE b.id=led.booking_id AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text))
        ), 0)::text AS outstanding,
        COALESCE((
          SELECT SUM(amount) FROM lodge_commission_settlements WHERE lodge_id = l.id
        ), 0)::text AS settled
      FROM lodges l
      LEFT JOIN lodge_commission_settings s ON s.lodge_id = l.id
      WHERE l.deleted_at IS NULL
      ORDER BY l.name ASC
    `);
  }

  private async getRevenueSummary(
    lodgeId: string,
    tx: Prisma.TransactionClient,
  ): Promise<LodgeRevenueSummary> {
    const rows = await tx.$queryRaw<LodgeRevenueSummary[]>(Prisma.sql`
      WITH receipts AS (
        SELECT COALESCE(SUM(pc.amount), 0) AS amount
        FROM payment_collections pc JOIN bookings b ON b.id = pc.booking_id
        WHERE b.lodge_id = ${lodgeId}::uuid AND b.deleted_at IS NULL
          AND public.tuljai_commission_is_eligible(b.status::text, b.payment_status::text)
          AND pc.method = 'ONLINE' AND pc.status = 'PAID'
      ), commission AS (
        SELECT COALESCE(SUM(GREATEST(l.commission_amount - COALESCE(a.amount, 0), 0)), 0) AS amount
        FROM lodge_commission_ledger l JOIN bookings b ON b.id = l.booking_id
        LEFT JOIN (
          SELECT ledger_id, SUM(amount) AS amount FROM lodge_commission_settlement_allocations GROUP BY ledger_id
        ) a ON a.ledger_id = l.id
        WHERE l.lodge_id = ${lodgeId}::uuid AND l.status <> 'VOIDED' AND b.deleted_at IS NULL
          AND public.tuljai_commission_is_eligible(b.status::text, b.payment_status::text)
          AND EXISTS (SELECT 1 FROM payment_collections pc WHERE pc.booking_id = b.id AND pc.method = 'ONLINE' AND pc.status = 'PAID')
      ), paid AS (
        SELECT COALESCE(SUM(amount), 0) AS amount, COALESCE(SUM(commission_deducted), 0) AS commission
        FROM lodge_revenue_settlements WHERE lodge_id = ${lodgeId}::uuid
      )
      SELECT receipts.amount::text AS "onlinePayments", commission.amount::text AS "commissionToDeduct",
        paid.commission::text AS "commissionDeducted", paid.amount::text AS "revenueSettled",
        GREATEST(receipts.amount - commission.amount - paid.amount - paid.commission, 0)::text AS "balancePayable"
      FROM receipts, commission, paid
    `);
    return rows[0]!;
  }

  public async createRevenueSettlement(
    lodgeId: string,
    dto: CreateRevenueSettlementDto,
    actorUserId: string,
  ): Promise<LodgeCommissionFinanceReport> {
    await this.assertLodge(lodgeId);
    if (!Number.isFinite(dto.amount) || dto.amount <= 0 || toMoney(dto.amount) !== dto.amount)
      throw new BadRequestException(
        'Enter a positive settlement amount with at most two decimals.',
      );
    if (!dto.paymentMethod.trim()) throw new BadRequestException('Payment method is required.');

    await this.prisma.$transaction(async (tx) => {
      // Booking-before-ledger order also serializes against cancellation and commission receipts.
      await tx.$queryRaw`SELECT id FROM bookings WHERE lodge_id = ${lodgeId}::uuid ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM lodges WHERE id = ${lodgeId}::uuid FOR UPDATE`;
      const previous = await tx.$queryRaw<
        Array<{
          lodgeId: string;
          amount: string;
          paymentMethod: string;
          reference: string | null;
          notes: string | null;
        }>
      >`SELECT lodge_id AS "lodgeId", amount::text, payment_method AS "paymentMethod", reference, notes
        FROM lodge_revenue_settlements WHERE idempotency_key = ${dto.idempotencyKey}::uuid`;
      if (previous[0]) {
        const saved = previous[0];
        if (
          saved.lodgeId !== lodgeId ||
          Number(saved.amount) !== dto.amount ||
          saved.paymentMethod !== dto.paymentMethod.trim() ||
          saved.reference !== (dto.reference ?? null) ||
          saved.notes !== (dto.notes ?? null)
        )
          throw new BadRequestException(
            'This settlement request was already used with different details.',
          );
        return;
      }

      const summary = await this.getRevenueSummary(lodgeId, tx);
      if (dto.amount > Number(summary.balancePayable))
        throw new BadRequestException(
          `Settlement exceeds balance payable of Rs. ${Number(summary.balancePayable).toFixed(2)}.`,
        );

      const commission = await tx.$queryRaw<Array<{ id: string; due: string }>>`
        SELECT l.id, GREATEST(l.commission_amount - COALESCE((
          SELECT SUM(a.amount) FROM lodge_commission_settlement_allocations a WHERE a.ledger_id = l.id
        ), 0), 0)::text AS due
        FROM lodge_commission_ledger l JOIN bookings b ON b.id = l.booking_id
        WHERE l.lodge_id = ${lodgeId}::uuid AND l.status = 'OUTSTANDING' AND b.deleted_at IS NULL
          AND public.tuljai_commission_is_eligible(b.status::text, b.payment_status::text)
          AND EXISTS (SELECT 1 FROM payment_collections pc WHERE pc.booking_id = b.id AND pc.method = 'ONLINE' AND pc.status = 'PAID')
        ORDER BY l.eligible_at, l.id FOR UPDATE OF l`;
      const deducted = toMoney(commission.reduce((sum, row) => sum + Number(row.due), 0));
      let commissionSettlementId: string | null = null;
      if (deducted > 0) {
        const entries = await tx.$queryRaw<Array<{ id: string }>>`
          INSERT INTO lodge_commission_settlements (lodge_id, amount, payment_method, reference, notes, settled_by_user_id)
          VALUES (${lodgeId}::uuid, ${deducted}, 'REVENUE_OFFSET', ${dto.reference ?? null},
            'Commission deducted from online revenue payment to lodge', ${actorUserId}::uuid) RETURNING id`;
        commissionSettlementId = entries[0]!.id;
        for (const row of commission) {
          if (Number(row.due) <= 0) continue;
          await tx.$executeRaw`INSERT INTO lodge_commission_settlement_allocations (settlement_id, ledger_id, amount)
            VALUES (${commissionSettlementId}::uuid, ${row.id}::uuid, ${Number(row.due)})`;
          await tx.$executeRaw`UPDATE lodge_commission_ledger SET status = 'SETTLED', settled_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP WHERE id = ${row.id}::uuid`;
        }
      }
      const entries = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO lodge_revenue_settlements (lodge_id, amount, commission_deducted, commission_settlement_id,
          idempotency_key, payment_method, reference, notes, settled_by_user_id)
        VALUES (${lodgeId}::uuid, ${dto.amount}, ${deducted}, ${commissionSettlementId}::uuid,
          ${dto.idempotencyKey}::uuid, ${dto.paymentMethod.trim()}, ${dto.reference ?? null}, ${dto.notes ?? null}, ${actorUserId}::uuid)
        RETURNING id`;
      await tx.auditLog.create({
        data: {
          action: 'LODGE_REVENUE_SETTLEMENT_CREATED',
          actorUserId,
          entityId: entries[0]!.id,
          entityType: 'lodge_revenue_settlement',
          metadata: {
            lodgeId,
            amount: dto.amount,
            commissionDeducted: deducted,
            paymentMethod: dto.paymentMethod,
            reference: dto.reference ?? null,
          },
        },
      });
    });
    return this.getReport(lodgeId);
  }

  public async createSettlement(
    lodgeId: string,
    dto: CreateCommissionSettlementDto,
    actorUserId: string,
  ): Promise<LodgeCommissionFinanceReport> {
    await this.assertLodge(lodgeId);
    if (dto.amount <= 0)
      throw new BadRequestException('Settlement amount must be greater than zero.');
    if (!dto.paymentMethod.trim()) throw new BadRequestException('Payment method is required.');

    await this.prisma.$transaction(async (tx) => {
      // Use the same booking-before-ledger lock order as cancellation and its commission trigger.
      await tx.$queryRaw`SELECT b.id FROM bookings b INNER JOIN lodge_commission_ledger l ON l.booking_id=b.id
        WHERE l.lodge_id=${lodgeId}::uuid AND l.status='OUTSTANDING' ORDER BY b.id FOR UPDATE OF b`;
      const outstanding = await tx.$queryRaw<
        Array<{
          id: string;
          commissionAmount: string;
          allocated: string;
        }>
      >(Prisma.sql`
        SELECT
          l.id,
          l.commission_amount::text AS "commissionAmount",
          COALESCE((SELECT SUM(a.amount) FROM lodge_commission_settlement_allocations a WHERE a.ledger_id = l.id), 0)::text AS allocated
        FROM lodge_commission_ledger l
        WHERE l.lodge_id = ${lodgeId}::uuid AND l.status = 'OUTSTANDING'
          AND EXISTS (SELECT 1 FROM bookings b WHERE b.id=l.booking_id AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text))
        ORDER BY l.eligible_at ASC, l.created_at ASC
        FOR UPDATE
      `);

      const totalOutstanding = toMoney(
        outstanding.reduce(
          (sum, row) => sum + Math.max(Number(row.commissionAmount) - Number(row.allocated), 0),
          0,
        ),
      );
      if (dto.amount > totalOutstanding + 0.005) {
        throw new BadRequestException(
          `Settlement exceeds outstanding commission of Rs. ${totalOutstanding.toFixed(2)}.`,
        );
      }

      const settlementRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO lodge_commission_settlements (lodge_id, amount, payment_method, reference, notes, settled_by_user_id)
        VALUES (${lodgeId}::uuid, ${dto.amount}, ${dto.paymentMethod.trim()}, ${dto.reference ?? null}, ${dto.notes ?? null}, ${actorUserId}::uuid)
        RETURNING id
      `);
      const settlementId = settlementRows[0]?.id;

      if (!settlementId) {
        throw new InternalServerErrorException('Commission settlement could not be created.');
      }

      let remaining = toMoney(dto.amount);
      for (const row of outstanding) {
        if (remaining <= 0.005) break;
        const due = toMoney(Math.max(Number(row.commissionAmount) - Number(row.allocated), 0));
        if (due <= 0) continue;
        const allocation = toMoney(Math.min(remaining, due));

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO lodge_commission_settlement_allocations (settlement_id, ledger_id, amount)
          VALUES (${settlementId}::uuid, ${row.id}::uuid, ${allocation})
        `);

        const newAllocated = toMoney(Number(row.allocated) + allocation);
        if (newAllocated + 0.005 >= Number(row.commissionAmount)) {
          await tx.$executeRaw(Prisma.sql`
            UPDATE lodge_commission_ledger
            SET status = 'SETTLED', settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${row.id}::uuid
          `);
        }
        remaining = toMoney(remaining - allocation);
      }
    });

    await this.auditLogService.create({
      action: 'LODGE_COMMISSION_SETTLEMENT_CREATED',
      actorUserId,
      entityId: lodgeId,
      entityType: 'lodge',
      metadata: {
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference ?? null,
      },
    });

    return this.getReport(lodgeId);
  }

  public async voidTransaction(ledgerId: string, actorUserId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<
      Array<{ allocated: string; lodgeId: string; status: string }>
    >(Prisma.sql`
      SELECT
        l.lodge_id AS "lodgeId",
        l.status,
        COALESCE((SELECT SUM(a.amount) FROM lodge_commission_settlement_allocations a WHERE a.ledger_id = l.id), 0)::text AS allocated
      FROM lodge_commission_ledger l
      WHERE l.id = ${ledgerId}::uuid
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) throw new NotFoundException('Commission transaction not found.');
    if (row.status === 'VOIDED')
      throw new BadRequestException('This commission transaction is already voided.');
    if (row.status === 'SETTLED')
      throw new BadRequestException('A settled commission cannot be voided.');
    if (Number(row.allocated) > 0)
      throw new BadRequestException(
        'Settlement payments are already applied to this commission, so it cannot be voided.',
      );

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE lodge_commission_ledger
      SET status = 'VOIDED', voided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${ledgerId}::uuid
    `);

    await this.auditLogService.create({
      action: 'LODGE_COMMISSION_TRANSACTION_VOIDED',
      actorUserId,
      entityId: ledgerId,
      entityType: 'lodge_commission_ledger',
      metadata: { lodgeId: row.lodgeId },
    });
  }

  private async assertLodge(lodgeId: string): Promise<void> {
    await this.lodgeAccessService.assertLodgeExists(lodgeId);
  }
}
