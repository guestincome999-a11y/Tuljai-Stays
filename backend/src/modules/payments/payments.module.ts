import { Module } from '@nestjs/common';

import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { FinanceAdminController } from './finance-admin.controller';
import { FinanceAdminService } from './finance-admin.service';
import { PaymentNotificationsService } from './payment-notifications.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentProvidersModule } from './providers/providers.module';

@Module({
  imports: [BookingsModule, NotificationsModule, PaymentProvidersModule],
  controllers: [FinanceAdminController, PaymentsController],
  providers: [FinanceAdminService, PaymentsService, PaymentNotificationsService],
  exports: [PaymentsService, PaymentNotificationsService, PaymentProvidersModule],
})
export class PaymentsModule {}
