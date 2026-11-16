import { Module } from '@nestjs/common';

import { BookingAvailabilityModule } from '../bookings/booking-availability.module';
import { PaymentProvidersModule } from '../payments/providers/providers.module';
import { RealtimeModule } from '../realtime/realtime.module';


import { LodgeCommissionFinanceController } from './commission-finance.controller';
import { LodgeCommissionFinanceService } from './commission-finance.service';
import { CommissionPaymentService } from './commission-payment.service';
import { LodgeCommissionController } from './commission.controller';
import { LodgeCommissionService } from './commission.service';
import { LodgeAccessService } from './lodge-access.service';
import { LodgesController } from './lodges.controller';
import { LodgesService } from './lodges.service';
import { OwnerFinanceController } from './owner-finance.controller';
import { OwnerFinanceService } from './owner-finance.service';

@Module({
  imports: [BookingAvailabilityModule, RealtimeModule, PaymentProvidersModule],
  controllers: [
    LodgesController,
    LodgeCommissionController,
    LodgeCommissionFinanceController,
    OwnerFinanceController,
  ],
  providers: [
    CommissionPaymentService,
    OwnerFinanceService,
    LodgesService,
    LodgeAccessService,
    LodgeCommissionService,
    LodgeCommissionFinanceService,
  ],
  exports: [
    CommissionPaymentService,
    LodgesService,
    LodgeAccessService,
    LodgeCommissionService,
    LodgeCommissionFinanceService,
  ],
})
export class LodgesModule {}
