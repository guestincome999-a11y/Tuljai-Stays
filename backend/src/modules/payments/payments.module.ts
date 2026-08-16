import { Module } from '@nestjs/common';

import { PaymentProvidersModule } from './providers/providers.module';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PaymentProvidersModule],
  providers: [PaymentsService],
  exports: [PaymentsService, PaymentProvidersModule],
})
export class PaymentsModule {}
