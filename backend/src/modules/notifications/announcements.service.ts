import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Announcement, Prisma } from '@prisma/client';
import type {
  Announcement as SharedAnnouncement,
  AuthenticatedUser,
  PaginatedResponse,
} from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

import type {
  CreateAnnouncementDto,
  ListAnnouncementsQueryDto,
  UpdateAnnouncementDto,
} from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Injectable()
export class AnnouncementsService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  public async create(
    dto: CreateAnnouncementDto,
    user: AuthenticatedUser,
  ): Promise<SharedAnnouncement> {
    this.validateTarget(dto);
    const announcement = await this.prisma.announcement.create({
      data: {
        body: dto.body,
        category: dto.category,
        createdByUserId: user.id,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        priority: dto.priority,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        targetAudience: dto.targetAudience,
        targetCityId: dto.targetCityId,
        targetLodgeId: dto.targetLodgeId,
        title: dto.title,
      },
      include: this.announcementInclude(user.id),
    });
    await this.auditLogService.create({
      action: 'ANNOUNCEMENT_CREATED',
      actorUserId: user.id,
      entityId: announcement.id,
      entityType: 'announcement',
    });
    await this.publishAnnouncement(announcement);

    return this.toAnnouncement(announcement);
  }

  public async listVisible(
    query: ListAnnouncementsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<SharedAnnouncement>> {
    const pagination = normalizePagination(query.page, query.limit);
    const now = new Date();
    const where: Prisma.AnnouncementWhereInput = {
      deletedAt: null,
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, this.visibleWhere(user)],
      ...(query.category ? { category: query.category } : {}),
      ...(query.unreadOnly === 'true'
        ? {
            reads: {
              none: { userId: user.id },
            },
          }
        : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        include: this.announcementInclude(user.id),
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        where,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      items: items.map((announcement) => this.toAnnouncement(announcement)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  public async markRead(id: string, user: AuthenticatedUser): Promise<{ success: true }> {
    await this.ensureVisible(id, user);
    await this.prisma.announcementRead.upsert({
      create: { announcementId: id, readAt: new Date(), userId: user.id },
      update: { readAt: new Date() },
      where: { announcementId_userId: { announcementId: id, userId: user.id } },
    });

    return { success: true };
  }

  public async update(
    id: string,
    dto: UpdateAnnouncementDto,
    user: AuthenticatedUser,
  ): Promise<SharedAnnouncement> {
    this.validateTarget(dto);
    const announcement = await this.prisma.announcement.update({
      data: {
        body: dto.body,
        category: dto.category,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        priority: dto.priority,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        targetAudience: dto.targetAudience,
        targetCityId: dto.targetCityId,
        targetLodgeId: dto.targetLodgeId,
        title: dto.title,
      },
      include: this.announcementInclude(user.id),
      where: { id },
    });
    await this.auditLogService.create({
      action: 'ANNOUNCEMENT_UPDATED',
      actorUserId: user.id,
      entityId: id,
      entityType: 'announcement',
    });
    await this.publishAnnouncement(announcement);

    return this.toAnnouncement(announcement);
  }

  public async softDelete(id: string, user: AuthenticatedUser): Promise<{ success: true }> {
    await this.prisma.announcement.update({
      data: { deletedAt: new Date(), isActive: false },
      where: { id },
    });
    await this.auditLogService.create({
      action: 'ANNOUNCEMENT_DELETED',
      actorUserId: user.id,
      entityId: id,
      entityType: 'announcement',
    });

    return { success: true };
  }

  private readonly announcementInclude = (userId: string) =>
    ({
      reads: {
        where: { userId },
      },
    }) satisfies Prisma.AnnouncementInclude;

  private async ensureVisible(id: string, user: AuthenticatedUser): Promise<void> {
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        deletedAt: null,
        id,
        isActive: true,
        AND: [this.visibleWhere(user)],
      },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }
  }

  private async publishAnnouncement(announcement: Announcement): Promise<void> {
    if (!this.isPublishableNow(announcement)) {
      return;
    }

    const notificationPriority =
      announcement.category === 'EMERGENCY' ? 'CRITICAL' : announcement.priority;
    const payload = {
      announcementId: announcement.id,
      category: announcement.category,
      priority: notificationPriority,
      title: announcement.title,
    };

    if (announcement.targetAudience === 'LODGE_SPECIFIC' && announcement.targetLodgeId) {
      this.realtimeEventsService.publishToLodge(
        announcement.targetLodgeId,
        'announcement:new',
        payload,
      );
    } else if (announcement.targetAudience === 'CITY_SPECIFIC' && announcement.targetCityId) {
      this.realtimeEventsService.publishToCity(
        announcement.targetCityId,
        'announcement:new',
        payload,
      );
    } else if (announcement.targetAudience === 'OWNERS') {
      this.realtimeEventsService.publishToRole('OWNER', 'announcement:new', payload);
    } else if (announcement.targetAudience === 'ADMINS') {
      this.realtimeEventsService.publishToRole('ADMIN', 'announcement:new', payload);
    } else if (announcement.targetAudience === 'PILGRIMS') {
      this.realtimeEventsService.publishToRole('PILGRIM', 'announcement:new', payload);
    } else {
      this.realtimeEventsService.publishToRole('PILGRIM', 'announcement:new', payload);
      this.realtimeEventsService.publishToRole('OWNER', 'announcement:new', payload);
      this.realtimeEventsService.publishToRole('ADMIN', 'announcement:new', payload);
    }

    const recipientUserIds = await this.getRecipientUserIds(announcement);

    await this.notificationsService.createManyForUsers(recipientUserIds, {
      body: announcement.body,
      data: payload,
      priority: notificationPriority,
      recipientRole: this.mapTargetAudienceToRole(announcement.targetAudience),
      title: announcement.title,
      type: announcement.category === 'EMERGENCY' ? 'EMERGENCY_ALERT' : 'ADMIN_ANNOUNCEMENT',
    });
  }

  private isPublishableNow(announcement: Announcement): boolean {
    const now = new Date();

    return (
      announcement.isActive &&
      !announcement.deletedAt &&
      (!announcement.startsAt || announcement.startsAt <= now) &&
      (!announcement.expiresAt || announcement.expiresAt > now)
    );
  }

  private mapTargetAudienceToRole(targetAudience: Announcement['targetAudience']) {
    if (targetAudience === 'PILGRIMS') {
      return 'PILGRIM';
    }

    if (targetAudience === 'OWNERS') {
      return 'OWNER';
    }

    if (targetAudience === 'ADMINS') {
      return 'ADMIN';
    }

    if (targetAudience === 'LODGE_SPECIFIC' || targetAudience === 'CITY_SPECIFIC') {
      return 'OWNER';
    }

    return undefined;
  }

  private async getRecipientUserIds(announcement: Announcement): Promise<string[]> {
    const baseWhere: Prisma.UserWhereInput = {
      deletedAt: null,
      isActive: true,
    };
    let audienceWhere: Prisma.UserWhereInput;

    if (announcement.targetAudience === 'PILGRIMS') {
      audienceWhere = { roles: { has: 'PILGRIM' } };
    } else if (announcement.targetAudience === 'OWNERS') {
      audienceWhere = { roles: { has: 'OWNER' } };
    } else if (announcement.targetAudience === 'ADMINS') {
      audienceWhere = { roles: { hasSome: ['ADMIN', 'SUPER_ADMIN'] } };
    } else if (announcement.targetAudience === 'LODGE_SPECIFIC') {
      audienceWhere = {
        ownedLodges: {
          some: {
            deletedAt: null,
            isActive: true,
            lodgeId: announcement.targetLodgeId ?? undefined,
          },
        },
      };
    } else if (announcement.targetAudience === 'CITY_SPECIFIC') {
      audienceWhere = {
        ownedLodges: {
          some: {
            deletedAt: null,
            isActive: true,
            lodge: {
              cityId: announcement.targetCityId ?? undefined,
            },
          },
        },
      };
    } else {
      audienceWhere = {};
    }

    const users = await this.prisma.user.findMany({
      select: { id: true },
      where: {
        ...baseWhere,
        ...audienceWhere,
      },
    });

    return users.map((user) => user.id);
  }

  private toAnnouncement(
    announcement: Announcement & { reads?: Array<{ readAt: Date }> },
  ): SharedAnnouncement {
    return {
      body: announcement.body,
      category: announcement.category,
      createdAt: announcement.createdAt.toISOString(),
      expiresAt: announcement.expiresAt?.toISOString() ?? null,
      id: announcement.id,
      isActive: announcement.isActive,
      priority: announcement.priority,
      readAt: announcement.reads?.[0]?.readAt.toISOString() ?? null,
      startsAt: announcement.startsAt?.toISOString() ?? null,
      targetAudience: announcement.targetAudience,
      targetCityId: announcement.targetCityId,
      targetLodgeId: announcement.targetLodgeId,
      title: announcement.title,
    };
  }

  private validateTarget(dto: CreateAnnouncementDto | UpdateAnnouncementDto): void {
    if (dto.targetAudience === 'LODGE_SPECIFIC' && !dto.targetLodgeId) {
      throw new BadRequestException('targetLodgeId is required for lodge-specific announcements');
    }

    if (dto.targetAudience === 'CITY_SPECIFIC' && !dto.targetCityId) {
      throw new BadRequestException('targetCityId is required for city-specific announcements');
    }
  }

  private visibleWhere(user: AuthenticatedUser): Prisma.AnnouncementWhereInput {
    if (user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN')) {
      return {};
    }

    if (user.roles.includes('OWNER')) {
      return {
        OR: [
          { targetAudience: { in: ['ALL', 'OWNERS'] } },
          {
            targetAudience: 'LODGE_SPECIFIC',
            targetLodge: {
              owners: {
                some: {
                  deletedAt: null,
                  isActive: true,
                  userId: user.id,
                },
              },
            },
          },
        ],
      };
    }

    return {
      targetAudience: { in: ['ALL', 'PILGRIMS'] },
    };
  }
}
