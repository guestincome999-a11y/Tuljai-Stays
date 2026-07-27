import { Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';

import { AnnouncementsService } from './announcements.service';
import { DeviceTargetingService } from './device-targeting.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationEventsService } from './notification-events.service';
import { NotificationTemplatesService } from './notification-templates.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpoPushService } from './providers/expo-push.service';
import { FcmService } from './providers/fcm.service';

@Module({
  imports: [RealtimeModule],
  controllers: [NotificationsController],
  providers: [
    AnnouncementsService,
    DeviceTargetingService,
    ExpoPushService,
    FcmService,
    NotificationDeliveryService,
    NotificationEventsService,
    NotificationTemplatesService,
    NotificationsService,
  ],
  exports: [
    AnnouncementsService,
    ExpoPushService,
    FcmService,
    NotificationDeliveryService,
    NotificationEventsService,
    NotificationTemplatesService,
    NotificationsService,
  ],
})
export class NotificationsModule {}
