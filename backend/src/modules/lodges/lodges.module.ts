import { Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';

import { LodgeAccessService } from './lodge-access.service';
import { LodgeCommissionController } from './commission.controller';
import { LodgeCommissionService } from './commission.service';
import { LodgesController } from './lodges.controller';
import { LodgesService } from './lodges.service';

@Module({
  imports: [RealtimeModule],
  controllers: [LodgesController, LodgeCommissionController],
  providers: [LodgesService, LodgeAccessService, LodgeCommissionService],
  exports: [LodgesService, LodgeAccessService, LodgeCommissionService],
})
export class LodgesModule {}
