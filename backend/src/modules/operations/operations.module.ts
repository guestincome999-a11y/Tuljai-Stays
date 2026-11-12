import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { BookingsModule } from '../bookings/bookings.module';
import { CatalogModule } from '../catalog/catalog.module';
import { LodgesModule } from '../lodges/lodges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SettingsModule } from '../settings/settings.module';

import { DashboardOperationsService } from './dashboard-operations.service';
import { FestivalOperationsController } from './festival-operations.controller';
import { FestivalOperationsService } from './festival-operations.service';
import { OperationsTelemetry } from './operations-telemetry';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [
    LodgesModule,
    RealtimeModule,
    BookingsModule,
    CatalogModule,
    SettingsModule,
    PaymentsModule,
    NotificationsModule,
  ],
  controllers: [OperationsController, FestivalOperationsController],
  providers: [
    DashboardOperationsService,
    OperationsService,
    FestivalOperationsService,
    OperationsTelemetry,
    { provide: APP_INTERCEPTOR, useExisting: OperationsTelemetry },
  ],
})
export class OperationsModule {}
