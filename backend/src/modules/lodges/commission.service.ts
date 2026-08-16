import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import type { UpdateLodgeCommissionDto } from './dto/commission.dto';

export interface LodgeCommissionConfig {
  lodgeId: string;
  commissionEnabled: boolean;
  commissionRatePercent: number;
  effectiveFrom: string;
}

@Injectable()
export class LodgeCommissionService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  public async get(lodgeId: string): Promise<LodgeCommissionConfig> {
    await this.assertLodgeExists(lodgeId);

    const rows = await this.prisma.$queryRaw<LodgeCommissionConfig[]>(Prisma.sql`
      SELECT
        lodge_id AS "lodgeId",
        commission_enabled AS "commissionEnabled",
        commission_rate_percent::float8 AS "commissionRatePercent",
        effective_from::text AS "effectiveFrom"
      FROM lodge_commission_settings
      WHERE lodge_id = ${lodgeId}::uuid
      LIMIT 1
    `);

    if (rows[0]) return rows[0];

    return {
      lodgeId,
      commissionEnabled: false,
      commissionRatePercent: 0,
      effectiveFrom: new Date().toISOString(),
    };
  }

  public async update(
    lodgeId: string,
    dto: UpdateLodgeCommissionDto,
    actorUserId: string,
  ): Promise<LodgeCommissionConfig> {
    await this.assertLodgeExists(lodgeId);
    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();

    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new Error('Invalid commission effective date.');
    }

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO lodge_commission_settings (
        lodge_id,
        commission_enabled,
        commission_rate_percent,
        effective_from,
        updated_at
      )
      VALUES (
        ${lodgeId}::uuid,
        ${dto.commissionEnabled},
        ${dto.commissionRatePercent},
        ${effectiveFrom},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (lodge_id)
      DO UPDATE SET
        commission_enabled = EXCLUDED.commission_enabled,
        commission_rate_percent = EXCLUDED.commission_rate_percent,
        effective_from = EXCLUDED.effective_from,
        updated_at = CURRENT_TIMESTAMP
    `);

    await this.auditLogService.create({
      action: 'LODGE_COMMISSION_UPDATED',
      actorUserId,
      entityId: lodgeId,
      entityType: 'lodge',
      metadata: {
        commissionEnabled: dto.commissionEnabled,
        commissionRatePercent: dto.commissionRatePercent,
        effectiveFrom: effectiveFrom.toISOString(),
      },
    });

    return this.get(lodgeId);
  }

  private async assertLodgeExists(lodgeId: string): Promise<void> {
    const lodge = await this.prisma.lodge.findFirst({
      select: { id: true },
      where: { deletedAt: null, id: lodgeId },
    });

    if (!lodge) throw new NotFoundException('Lodge not found');
  }
}
