import { Module } from '@nestjs/common';

import { PaymentProvidersModule } from './providers/providers.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PaymentProvidersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService, PaymentProvidersModule],
})
export class PaymentsModule {}
