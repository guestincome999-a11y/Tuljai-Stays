import { Injectable } from '@nestjs/common';
import type { Notification } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { DeviceTargetingService } from './device-targeting.service';
import { ExpoPushService } from './providers/expo-push.service';
import { FcmService } from './providers/fcm.service';

@Injectable()
export class NotificationDeliveryService {
  public constructor(
    private readonly deviceTargetingService: DeviceTargetingService,
    private readonly expoPushService: ExpoPushService,
    private readonly fcmService: FcmService,
    private readonly prisma: PrismaService,
  ) {}

  public async sendPushToUser(notification: Notification): Promise<void> {
    if (!notification.recipientUserId) {
      return;
    }

    const targetAppType =
      notification.type === 'BOOKING_REQUEST' || notification.recipientRole === 'OWNER'
        ? 'OWNER_APP'
        : notification.recipientRole === 'PILGRIM'
          ? 'PILGRIM_APP'
          : undefined;
    const devices = await this.deviceTargetingService.getActiveUserDevices(
      notification.recipientUserId,
      targetAppType,
    );

    if (devices.length === 0) {
      await this.prisma.notificationDeliveryLog.create({
        data: {
          channel: 'PUSH',
          notificationId: notification.id,
          provider: 'FCM',
          status: 'SKIPPED',
          userId: notification.recipientUserId,
          failureReason: 'No active devices',
        },
      });
      return;
    }

    const badge = await this.prisma.notification.count({
      where: {
        deletedAt: null,
        readAt: null,
        recipientUserId: notification.recipientUserId,
      },
    });

    for (const device of devices) {
      const data = this.toFcmData(notification);
      const highPriority = ['HIGH', 'CRITICAL'].includes(notification.priority);
      const usesExpoPush = this.expoPushService.isExpoPushToken(device.fcmToken);
      const result = usesExpoPush
        ? await this.expoPushService.sendToToken({
            badge,
            body: notification.body,
            data,
            expoPushToken: device.fcmToken,
            highPriority,
            title: notification.title,
          })
        : await this.fcmService.sendToToken({
            badge,
            body: notification.body,
            data,
            fcmToken: device.fcmToken,
            highPriority,
            title: notification.title,
          });
      await this.prisma.notificationDeliveryLog.create({
        data: {
          attemptCount: 1,
          channel: 'PUSH',
          deviceTokenId: device.id,
          failureReason: result.error,
          lastAttemptAt: new Date(),
          notificationId: notification.id,
          provider: usesExpoPush ? 'EXPO' : 'FCM',
          providerMessageId: result.messageId,
          status: result.success ? 'SENT' : 'FAILED',
          userId: notification.recipientUserId,
        },
      });

      if (
        !result.success &&
        (result.error?.toLowerCase().includes('registration-token') ||
          result.error?.toLowerCase().includes('devicenotregistered'))
      ) {
        await this.deviceTargetingService.deactivateToken(device.id);
      }
    }
  }

  public async retryFailedNotifications(): Promise<number> {
    const failedLogs = await this.prisma.notificationDeliveryLog.findMany({
      include: { notification: true },
      take: 50,
      where: {
        attemptCount: { lt: 3 },
        channel: 'PUSH',
        status: 'FAILED',
      },
    });

    for (const log of failedLogs) {
      await this.sendPushToUser(log.notification);
    }

    return failedLogs.length;
  }

  private toFcmData(notification: Notification): Record<string, string> {
    const baseData = {
      notificationId: notification.id,
      priority: notification.priority,
      type: notification.type,
    };
    const data =
      notification.data && typeof notification.data === 'object' ? notification.data : {};

    return Object.entries({ ...data, ...baseData }).reduce<Record<string, string>>(
      (accumulator, [key, value]) => {
        if (value !== null && value !== undefined) {
          accumulator[key] = String(value);
        }

        return accumulator;
      },
      {},
    );
  }
}
