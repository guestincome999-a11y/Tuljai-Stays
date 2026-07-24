import { Injectable } from '@nestjs/common';
import type { Notification } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { DeviceTargetingService } from './device-targeting.service';
import { FcmService } from './providers/fcm.service';

@Injectable()
export class NotificationDeliveryService {
  public constructor(
    private readonly deviceTargetingService: DeviceTargetingService,
    private readonly fcmService: FcmService,
    private readonly prisma: PrismaService,
  ) {}

  public async sendPushToUser(notification: Notification): Promise<void> {
    if (!notification.recipientUserId) {
      return;
    }

    const devices = await this.deviceTargetingService.getActiveUserDevices(
      notification.recipientUserId,
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

    for (const device of devices) {
      const result = await this.fcmService.sendToToken({
        body: notification.body,
        data: this.toFcmData(notification),
        fcmToken: device.fcmToken,
        highPriority: ['HIGH', 'CRITICAL'].includes(notification.priority),
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
          provider: 'FCM',
          providerMessageId: result.messageId,
          status: result.success ? 'SENT' : 'FAILED',
          userId: notification.recipientUserId,
        },
      });

      if (!result.success && result.error?.toLowerCase().includes('registration-token')) {
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
