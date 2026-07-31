import { Injectable, Logger } from '@nestjs/common';

import { resolveAndroidNotificationChannel } from '../notification-routing';

interface ExpoPushTicket {
  details?: { error?: string };
  id?: string;
  message?: string;
  status?: 'error' | 'ok';
}

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  public isExpoPushToken(token: string): boolean {
    return /^(?:Expo|Exponent)PushToken\[[^\]]+\]$/u.test(token);
  }

  public async sendToToken(input: {
    badge?: number;
    body: string;
    data: Record<string, string>;
    expoPushToken: string;
    highPriority?: boolean;
    title: string;
  }): Promise<{ messageId?: string; success: boolean; error?: string }> {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        body: JSON.stringify({
          badge: input.badge,
          body: input.body,
          categoryId: input.data.type === 'BOOKING_REQUEST' ? 'BOOKING_REQUEST' : undefined,
          channelId: resolveAndroidNotificationChannel(input.data),
          data: input.data,
          priority: input.highPriority ? 'high' : 'default',
          sound: 'default',
          title: input.title,
          to: input.expoPushToken,
        }),
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        return { success: false, error: `Expo push request failed (${response.status})` };
      }

      const payload = (await response.json()) as { data?: ExpoPushTicket };
      const ticket = payload.data;

      if (ticket?.status === 'ok') {
        return { messageId: ticket.id, success: true };
      }

      return {
        success: false,
        error: ticket?.details?.error ?? ticket?.message ?? 'Expo push delivery failed',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Expo push error';
      this.logger.warn(`Expo push send failed: ${message}`);

      return { success: false, error: message };
    }
  }
}
