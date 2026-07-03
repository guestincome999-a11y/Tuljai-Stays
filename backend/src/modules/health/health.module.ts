import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { StorageModule } from '../storage/storage.module';

import { HealthController } from './health.controller';

@Module({
  imports: [NotificationsModule, RealtimeModule, StorageModule],
  controllers: [HealthController],
})
export class HealthModule {}
