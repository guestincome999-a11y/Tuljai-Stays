import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { PrismaService } from '../../modules/prisma/prisma.service';

class AuditQuery {
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsString() @MaxLength(80) action?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
}

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: AuditQuery) {
    const page = query.page ?? 1;
    const pageSize = 30;
    const where = {
      entityId: query.entityId,
      action: query.action ? { contains: query.action, mode: 'insensitive' as const } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { displayName: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: items.map((entry) => ({
        id: entry.id,
        at: entry.createdAt.toISOString(),
        action: entry.action,
        entityId: entry.entityId,
        entityType: entry.entityType,
        actor: entry.actor?.displayName ?? entry.actorUserId ?? 'System',
        metadata: entry.metadata,
      })),
      total,
      page,
      pageSize,
    };
  }
}
