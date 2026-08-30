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
} from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import { CreateCommissionSettlementDto } from './dto/commission-settlement.dto';
import { LodgeAccessService } from './lodge-access.service';

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

    const [lodgeRows, settingRows, transactionRows, settlementRows, summaryRows] =
      await Promise.all([
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
            COALESCE((SELECT SUM(total_amount) FROM bookings WHERE lodge_id = ${lodgeId}::uuid AND deleted_at IS NULL), 0)::text AS "bookingRevenue",
            COALESCE((SELECT SUM(commission_amount) FROM lodge_commission_ledger WHERE lodge_id = ${lodgeId}::uuid AND status <> 'VOIDED'), 0)::text AS "commissionReceivable",
            COALESCE((
              SELECT SUM(GREATEST(l.commission_amount - COALESCE(a.allocated_amount, 0), 0))
              FROM lodge_commission_ledger l
              LEFT JOIN (
                SELECT ledger_id, SUM(amount) AS allocated_amount
                FROM lodge_commission_settlement_allocations
                GROUP BY ledger_id
              ) a ON a.ledger_id = l.id
              WHERE l.lodge_id = ${lodgeId}::uuid AND l.status <> 'VOIDED'
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
      ]);

    const lodge = lodgeRows[0];
    if (!lodge) throw new NotFoundException('Lodge not found');

    return {
      lodgeId: lodge.id,
      lodgeName: lodge.name,
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
        ORDER BY l.eligible_at ASC, l.created_at ASC
        FOR UPDATE
      `);

      const totalOutstanding = outstanding.reduce(
        (sum, row) => sum + Math.max(Number(row.commissionAmount) - Number(row.allocated), 0),
        0,
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

      let remaining = dto.amount;
      for (const row of outstanding) {
        if (remaining <= 0.005) break;
        const due = Math.max(Number(row.commissionAmount) - Number(row.allocated), 0);
        if (due <= 0) continue;
        const allocation = Math.min(remaining, due);

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO lodge_commission_settlement_allocations (settlement_id, ledger_id, amount)
          VALUES (${settlementId}::uuid, ${row.id}::uuid, ${allocation})
        `);

        const newAllocated = Number(row.allocated) + allocation;
        if (newAllocated + 0.005 >= Number(row.commissionAmount)) {
          await tx.$executeRaw(Prisma.sql`
            UPDATE lodge_commission_ledger
            SET status = 'SETTLED', settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${row.id}::uuid
          `);
        }
        remaining -= allocation;
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
    const rows = await this.prisma.$queryRaw<Array<{ lodgeId: string; status: string }>>(Prisma.sql`
      SELECT lodge_id AS "lodgeId", status FROM lodge_commission_ledger WHERE id = ${ledgerId}::uuid LIMIT 1
    `);
    const row = rows[0];
    if (!row) throw new NotFoundException('Commission transaction not found.');
    if (row.status === 'SETTLED')
      throw new BadRequestException('A settled commission cannot be voided.');

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
