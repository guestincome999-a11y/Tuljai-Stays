import { resolve } from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuditLogModule } from '../shared/audit/audit-log.module';
import { appConfig } from '../shared/config/app.config';
import { validateEnvironment } from '../shared/config/env.validation';

import { AmenitiesModule } from './amenities/amenities.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CitiesModule } from './cities/cities.module';
import { HealthModule } from './health/health.module';
import { LodgesModule } from './lodges/lodges.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OperationsModule } from './operations/operations.module';
import { OwnersModule } from './owners/owners.module';
import { PhotosModule } from './photos/photos.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReviewsModule } from './reviews/reviews.module';
import { RoomsModule } from './rooms/rooms.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [resolve(process.cwd(), 'backend/.env'), resolve(process.cwd(), '.env')],
      isGlobal: true,
      load: [appConfig],
      validate: validateEnvironment,
    }),
    AuditLogModule,
    PrismaModule,
    AuthModule,
    BookingsModule,
    CitiesModule,
    AmenitiesModule,
    LodgesModule,
    OwnersModule,
    RoomsModule,
    PhotosModule,
    HealthModule,
    RealtimeModule,
    NotificationsModule,
    ReviewsModule,
    SettingsModule,
    OperationsModule,
    StorageModule,
  ],
})
export class AppModule {}
