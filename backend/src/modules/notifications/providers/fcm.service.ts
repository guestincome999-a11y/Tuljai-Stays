import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

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
}
