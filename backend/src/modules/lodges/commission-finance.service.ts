import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LodgeCommissionFinanceService {
  public constructor(private readonly prisma: PrismaService) {}

  // Finance/report methods remain unchanged; this service is intentionally kept
  // on the raw SQL path because the commission accounting tables are introduced
  // by migrations and are not required to be represented by generated Prisma
  // models for the reporting endpoints.

  public async settleLodgeCommission(
    lodgeId: string,
    dto: {
      amount: number;
      paymentMethod: string;
      reference?: string | null;
      notes?: string | null;
    },
    actorUserId: string,
  ): Promise<{ settlementId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const outstanding = await tx.$queryRaw<Array<{
        id: string;
        commissionAmount: string;
        allocated: string;
      }>>(Prisma.sql`
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
        throw new BadRequestException(`Settlement exceeds outstanding commission of Rs. ${totalOutstanding.toFixed(2)}.`);
      }

      const settlementRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO lodge_commission_settlements (lodge_id, amount, payment_method, reference, notes, settled_by_user_id)
        VALUES (${lodgeId}::uuid, ${dto.amount}, ${dto.paymentMethod.trim()}, ${dto.reference ?? null}, ${dto.notes ?? null}, ${actorUserId}::uuid)
        RETURNING id
      `);
      const settlement = settlementRows[0];
      if (!settlement) {
        throw new BadRequestException('Settlement could not be created.');
      }
      const settlementId = settlement.id;

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

        remaining -= allocation;
      }

      return { settlementId };
    });
  }
}
