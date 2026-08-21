import { Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';

import { LodgeCommissionFinanceController } from './commission-finance.controller';
import { LodgeCommissionFinanceService } from './commission-finance.service';
import { LodgeCommissionController } from './commission.controller';
import { LodgeCommissionService } from './commission.service';
import { LodgeAccessService } from './lodge-access.service';
import { LodgesController } from './lodges.controller';
import { LodgesService } from './lodges.service';

@Module({
  imports: [RealtimeModule],
  controllers: [LodgesController, LodgeCommissionController, LodgeCommissionFinanceController],
  providers: [
    LodgesService,
    LodgeAccessService,
    LodgeCommissionService,
    LodgeCommissionFinanceService,
  ],
  exports: [
    LodgesService,
    LodgeAccessService,
    LodgeCommissionService,
    LodgeCommissionFinanceService,
  ],
})
export class LodgesModule {}
