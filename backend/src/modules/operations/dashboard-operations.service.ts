import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminActivityItem,
  AdminDashboardOperations,
  AdminLodgeAvailability,
  AdminSettlementSummary,
} from '@tuljai/types';

import { PrismaService } from '../prisma/prisma.service';

interface OutstandingRow {
  lodgeId: string;
  lodgeName: string;
  outstanding: string;
}

interface RecentSettlementRow {
  amount: string;
  id: string;
  lodgeName: string;
  paymentMethod: string;
  reference: string | null;
  settledAt: Date;
}

interface SettledTotalRow {
  lastSettledAt: Date | null;
  total: string;
}

// Audit entries that are pure noise on an operations feed.
const HIDDEN_ACTIVITY_ACTIONS = ['OTP_REQUESTED', 'OTP_VERIFIED'];
const UNAVAILABLE_ROOM_STATUSES = ['MAINTENANCE', 'BLOCKED'];

@Injectable()
export class DashboardOperationsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async adminDashboardOperations(): Promise<AdminDashboardOperations> {
    const [settlements, availability, activity] = await Promise.all([
      this.settlementSummary(),
      this.lodgeAvailability(),
      this.recentActivity(),
    ]);
    return { activity, availability, settlements };
  }

  private async settlementSummary(): Promise<AdminSettlementSummary> {
    const [outstandingRows, recentRows, settledRows] = await Promise.all([
      this.prisma.$queryRaw<OutstandingRow[]>(Prisma.sql`
        SELECT
          l.id AS "lodgeId",
          l.name AS "lodgeName",
          COALESCE(SUM(GREATEST(led.commission_amount - COALESCE(alloc.allocated_amount, 0), 0)), 0)::text AS outstanding
        FROM lodge_commission_ledger led
        INNER JOIN lodges l ON l.id = led.lodge_id AND l.deleted_at IS NULL
        LEFT JOIN (
          SELECT ledger_id, SUM(amount) AS allocated_amount
          FROM lodge_commission_settlement_allocations
          GROUP BY ledger_id
        ) alloc ON alloc.ledger_id = led.id
        WHERE led.status <> 'VOIDED'
        GROUP BY l.id, l.name
      `),
      this.prisma.$queryRaw<RecentSettlementRow[]>(Prisma.sql`
        SELECT
          s.id,
          l.name AS "lodgeName",
          s.amount::text AS amount,
          s.payment_method AS "paymentMethod",
          s.reference,
          s.settled_at AS "settledAt"
        FROM lodge_commission_settlements s
        INNER JOIN lodges l ON l.id = s.lodge_id
        ORDER BY s.settled_at DESC
        LIMIT 5
      `),
      this.prisma.$queryRaw<SettledTotalRow[]>(Prisma.sql`
        SELECT COALESCE(SUM(amount), 0)::text AS total, MAX(settled_at) AS "lastSettledAt"
        FROM lodge_commission_settlements
      `),
    ]);
    const owing = outstandingRows
      .map((row) => ({ ...row, value: Number(row.outstanding) }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);
    const settled = settledRows[0];
    return {
      lastSettledAt: settled?.lastSettledAt ? settled.lastSettledAt.toISOString() : null,
      lodgesAwaiting: owing.length,
      outstandingTotal: owing.reduce((sum, row) => sum + row.value, 0).toFixed(2),
      recent: recentRows.map((row) => ({
        amount: row.amount,
        id: row.id,
        lodgeName: row.lodgeName,
        paymentMethod: row.paymentMethod,
        reference: row.reference,
        settledAt: row.settledAt.toISOString(),
      })),
      settledTotal: settled?.total ?? '0',
      topOutstanding: owing.slice(0, 3).map((row) => ({
        lodgeId: row.lodgeId,
        lodgeName: row.lodgeName,
        outstanding: row.outstanding,
      })),
    };
  }

  private async lodgeAvailability(): Promise<AdminLodgeAvailability> {
    const grouped = await this.prisma.room.groupBy({
      _count: { _all: true },
      by: ['lodgeId', 'status'],
      where: { deletedAt: null, isActive: true, lodge: { deletedAt: null } },
    });
    const perLodge = new Map<string, { occupied: number; total: number; unavailable: number }>();
    for (const row of grouped) {
      const entry = perLodge.get(row.lodgeId) ?? { occupied: 0, total: 0, unavailable: 0 };
      const count = row._count._all;
      entry.total += count;
      if (row.status === 'OCCUPIED') entry.occupied += count;
      else if (UNAVAILABLE_ROOM_STATUSES.includes(row.status)) entry.unavailable += count;
      perLodge.set(row.lodgeId, entry);
    }
    const lodgeIds = [...perLodge.keys()];
    const lodges = lodgeIds.length
      ? await this.prisma.lodge.findMany({
          select: { id: true, name: true },
          where: { id: { in: lodgeIds } },
        })
      : [];
    const nameById = new Map<string, string>(
      lodges.map((lodge): [string, string] => [lodge.id, lodge.name]),
    );
    const rows = lodgeIds
      .map((lodgeId) => {
        const entry = perLodge.get(lodgeId) ?? { occupied: 0, total: 0, unavailable: 0 };
        return {
          lodgeId,
          name: nameById.get(lodgeId) ?? 'Unknown lodge',
          occupied: entry.occupied,
          remaining: entry.total - entry.occupied - entry.unavailable,
          total: entry.total,
          unavailable: entry.unavailable,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const totals = rows.reduce(
      (sum, row) => ({
        occupied: sum.occupied + row.occupied,
        remaining: sum.remaining + row.remaining,
        total: sum.total + row.total,
        unavailable: sum.unavailable + row.unavailable,
      }),
      { occupied: 0, remaining: 0, total: 0, unavailable: 0 },
    );
    return { lodgeCount: rows.length, rows, totals };
  }

  private async recentActivity(): Promise<AdminActivityItem[]> {
    const entries = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        action: true,
        actor: { select: { displayName: true } },
        createdAt: true,
        entityType: true,
        id: true,
      },
      take: 6,
      where: { action: { notIn: HIDDEN_ACTIVITY_ACTIONS } },
    });
    return entries.map((entry) => ({
      actorName: entry.actor?.displayName ?? null,
      createdAt: entry.createdAt.toISOString(),
      entityType: entry.entityType,
      id: entry.id,
      label: entry.action
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' '),
    }));
  }
}
