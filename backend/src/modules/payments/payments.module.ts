import { Module } from '@nestjs/common';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentProvidersModule } from './providers/providers.module';

@Module({
  imports: [PaymentProvidersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService, PaymentProvidersModule],
})
export class PaymentsModule {}
