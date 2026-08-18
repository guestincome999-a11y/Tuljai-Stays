import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { PaymentNotificationsService } from './payment-notifications.service';
import { PaymentProvidersModule } from './providers/providers.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [NotificationsModule, PaymentProvidersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentNotificationsService],
  exports: [PaymentsService, PaymentNotificationsService, PaymentProvidersModule],
})
export class PaymentsModule {}
