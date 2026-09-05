import { Module } from '@nestjs/common';

import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { PaymentNotificationsService } from './payment-notifications.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentProvidersModule } from './providers/providers.module';

@Module({
  imports: [BookingsModule, NotificationsModule, PaymentProvidersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentNotificationsService],
  exports: [PaymentsService, PaymentNotificationsService, PaymentProvidersModule],
})
export class PaymentsModule {}
