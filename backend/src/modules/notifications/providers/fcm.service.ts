import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Message, type Messaging } from 'firebase-admin/messaging';

import { resolveAndroidNotificationChannel } from '../notification-routing';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly app: App | null;

  public constructor(configService: ConfigService) {
    const projectId = configService.get<string>('api.fcm.projectId');
    const clientEmail = configService.get<string>('api.fcm.clientEmail');
    const privateKey = configService.get<string>('api.fcm.privateKey')?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.app = null;
      this.logger.warn('FCM is not configured. Push delivery is disabled until credentials exist.');
      return;
    }

    this.app =
      getApps()[0] ??
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
  }

  public getMessagingClient(): Messaging | null {
    return this.app ? getMessaging(this.app) : null;
  }

  public async sendToToken(input: {
    badge?: number;
    body: string;
    data: Record<string, string>;
    fcmToken: string;
    highPriority?: boolean;
    title: string;
  }): Promise<{ messageId?: string; success: boolean; error?: string }> {
    const messaging = this.getMessagingClient();

    if (!messaging) {
      return { success: false, error: 'FCM is not configured' };
    }

    try {
      const message: Message = {
        token: input.fcmToken,
        notification: {
          body: input.body,
          title: input.title,
        },
        data: input.data,
        android: {
          notification: {
            channelId: resolveAndroidNotificationChannel(input.data),
            notificationCount: input.badge,
          },
          priority: input.highPriority ? 'high' : 'normal',
        },
        apns: {
          headers: {
            'apns-priority': input.highPriority ? '10' : '5',
          },
          payload: {
            aps: {
              badge: input.badge,
              sound: 'default',
            },
          },
        },
      };
      const messageId = await messaging.send(message);

      return { messageId, success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown FCM error';
      this.logger.warn(`FCM send failed: ${message}`);

      return { success: false, error: message };
    }
  }
}
