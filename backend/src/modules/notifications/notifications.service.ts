import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import type {
  AuthenticatedUser,
  Notification as SharedNotification,
  NotificationUnreadCount,
  PaginatedResponse,
} from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

import type { ListNotificationsQueryDto } from './dto/notifications.dto';
import { NotificationDeliveryService } from './notification-delivery.service';

export interface CreateNotificationInput {
  body: string;
  bookingId?: string;
  channel?: NotificationChannel;
  data?: Record<string, unknown>;
  lodgeId?: string;
  priority?: NotificationPriority;
  recipientRole?: UserRole;
  recipientUserId?: string;
  title: string;
  type: NotificationType;
}

@Injectable()
export class NotificationsService {
  public constructor(
    private readonly deliveryService: NotificationDeliveryService,
    private readonly prisma: PrismaService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  public async create(input: CreateNotificationInput): Promise<SharedNotification> {
    const dedupeWindowStart = new Date(Date.now() - 120_000);
    const existing = await this.prisma.notification.findFirst({
      where: {
        bookingId: input.bookingId,
        createdAt: { gte: dedupeWindowStart },
        deletedAt: null,
        recipientUserId: input.recipientUserId,
        type: input.type,
      },
    });

    if (existing) {
      return this.toNotification(existing);
    }

    const notification = await this.prisma.notification.create({
      data: {
        body: input.body,
        bookingId: input.bookingId,
        channel: input.channel ?? 'IN_APP',
        data: input.data as Prisma.InputJsonValue | undefined,
        lodgeId: input.lodgeId,
        priority: input.priority ?? 'NORMAL',
        recipientRole: input.recipientRole,
        recipientUserId: input.recipientUserId,
        title: input.title,
        type: input.type,
      },
    });

    if (notification.recipientUserId) {
      this.realtimeEventsService.publishToUser(notification.recipientUserId, 'notification:new', {
        notification: this.toNotification(notification),
      });
      this.realtimeEventsService.publishToUser(
        notification.recipientUserId,
        'notification:unread-count',
        {
          unreadCount: await this.getUnreadCountForUser(notification.recipientUserId),
        },
      );
      void this.deliveryService.sendPushToUser(notification);
    }

    if (notification.recipientRole) {
      this.realtimeEventsService.publishToRole(notification.recipientRole, 'notification:new', {
        notification: this.toNotification(notification),
      });
    }

    return this.toNotification(notification);
  }

  public async createManyForUsers(
    userIds: string[],
    input: Omit<CreateNotificationInput, 'recipientUserId'>,
  ): Promise<void> {
    for (const userId of userIds) {
      await this.create({ ...input, recipientUserId: userId });
    }
  }

  public async listForUser(
    query: ListNotificationsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<SharedNotification>> {
    const pagination = normalizePagination(query.page, query.limit);
    const where: Prisma.NotificationWhereInput = {
      deletedAt: null,
      recipientUserId: user.id,
      ...(query.type ? { type: query.type } : {}),
      ...(query.unreadOnly === 'true' ? { readAt: null } : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        where,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: items.map((notification) => this.toNotification(notification)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  public async unreadCount(user: AuthenticatedUser): Promise<NotificationUnreadCount> {
    return { unreadCount: await this.getUnreadCountForUser(user.id) };
  }

  public async markRead(id: string, user: AuthenticatedUser): Promise<SharedNotification> {
    await this.assertCanAccessNotification(id, user.id);
    const notification = await this.prisma.notification.update({
      data: { readAt: new Date() },
      where: { id },
    });

    return this.toNotification(notification);
  }

  public async markAllRead(user: AuthenticatedUser): Promise<NotificationUnreadCount> {
    await this.prisma.notification.updateMany({
      data: { readAt: new Date() },
      where: {
        deletedAt: null,
        readAt: null,
        recipientUserId: user.id,
      },
    });

    return this.unreadCount(user);
  }

  public async softDelete(id: string, user: AuthenticatedUser): Promise<{ success: true }> {
    await this.assertCanAccessNotification(id, user.id);
    await this.prisma.notification.update({
      data: { deletedAt: new Date() },
      where: { id },
    });

    return { success: true };
  }

  private async assertCanAccessNotification(id: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { deletedAt: null, id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.recipientUserId !== userId) {
      throw new ForbiddenException('You cannot access this notification');
    }
  }

  private async getUnreadCountForUser(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        deletedAt: null,
        readAt: null,
        recipientUserId: userId,
      },
    });
  }

  private toNotification(notification: {
    body: string;
    bookingId: string | null;
    channel: NotificationChannel;
    createdAt: Date;
    data: Prisma.JsonValue | null;
    deliveredAt: Date | null;
    failedAt: Date | null;
    failureReason: string | null;
    id: string;
    lodgeId: string | null;
    priority: NotificationPriority;
    readAt: Date | null;
    recipientRole: UserRole | null;
    recipientUserId: string | null;
    title: string;
    type: NotificationType;
  }): SharedNotification {
    return {
      body: notification.body,
      bookingId: notification.bookingId,
      channel: notification.channel,
      createdAt: notification.createdAt.toISOString(),
      data:
        notification.data && typeof notification.data === 'object'
          ? (notification.data as Record<string, unknown>)
          : null,
      deliveredAt: notification.deliveredAt?.toISOString() ?? null,
      failedAt: notification.failedAt?.toISOString() ?? null,
      failureReason: notification.failureReason,
      id: notification.id,
      lodgeId: notification.lodgeId,
      priority: notification.priority,
      readAt: notification.readAt?.toISOString() ?? null,
      recipientRole: notification.recipientRole,
      recipientUserId: notification.recipientUserId,
      title: notification.title,
      type: notification.type,
    };
  }
}
