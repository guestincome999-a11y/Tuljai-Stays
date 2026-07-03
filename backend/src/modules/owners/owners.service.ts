import { Injectable } from '@nestjs/common';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import type { AssignLodgeOwnerDto } from './dto/owner.dto';

@Injectable()
export class OwnersService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  public async assignOwner(
    lodgeId: string,
    dto: AssignLodgeOwnerDto,
    actorUserId: string,
  ): Promise<{ success: true }> {
    await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.lodgeOwner.updateMany({
          data: { isPrimary: false },
          where: { lodgeId },
        });
        await tx.lodge.update({
          data: { ownerUserId: dto.userId },
          where: { id: lodgeId },
        });
      }

      const user = await tx.user.findUniqueOrThrow({ where: { id: dto.userId } });

      if (!user.roles.includes('OWNER')) {
        await tx.user.update({
          data: {
            roles: {
              push: 'OWNER',
            },
          },
          where: { id: dto.userId },
        });
      }

      await tx.lodgeOwner.upsert({
        create: {
          isPrimary: dto.isPrimary ?? false,
          lodgeId,
          ownerEmail: dto.ownerEmail,
          ownerName: dto.ownerName,
          ownerPhone: dto.ownerPhone,
          roleTitle: dto.roleTitle,
          userId: dto.userId,
        },
        update: {
          isActive: true,
          isPrimary: dto.isPrimary ?? false,
          ownerEmail: dto.ownerEmail,
          ownerName: dto.ownerName,
          ownerPhone: dto.ownerPhone,
          roleTitle: dto.roleTitle,
        },
        where: {
          lodgeId_userId: {
            lodgeId,
            userId: dto.userId,
          },
        },
      });
    });

    await this.auditLogService.create({
      action: 'LODGE_OWNER_ASSIGNED',
      actorUserId,
      entityId: lodgeId,
      entityType: 'lodge',
      metadata: { ownerUserId: dto.userId },
    });

    return { success: true };
  }
}
