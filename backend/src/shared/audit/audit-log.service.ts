import { Injectable } from '@nestjs/common';

import { Prisma, type AuditLog } from '../../../generated/prisma';
import { PrismaService } from '../../modules/prisma/prisma.service';

export interface CreateAuditLogInput {
  action: string;
  actorUserId?: string;
  entityId?: string;
  entityType: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateAuditLogInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId,
        entityId: input.entityId,
        entityType: input.entityType,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
