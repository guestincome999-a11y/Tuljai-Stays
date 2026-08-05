import { Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';

import { LodgeAccessService } from './lodge-access.service';
import { LodgesController } from './lodges.controller';
import { LodgesService } from './lodges.service';

@Module({
  imports: [RealtimeModule],
  controllers: [LodgesController],
  providers: [LodgesService, LodgeAccessService],
  exports: [LodgesService, LodgeAccessService],
})
export class LodgesModule {}
