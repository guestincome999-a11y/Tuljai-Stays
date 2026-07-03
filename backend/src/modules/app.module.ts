import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { appConfig } from '../shared/config/app.config';
import { validateEnvironment } from '../shared/config/env.validation';

import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    RealtimeModule,
    NotificationsModule,
    StorageModule,
  ],
})
export class AppModule {}
