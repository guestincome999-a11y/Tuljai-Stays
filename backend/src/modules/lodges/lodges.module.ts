import { Module } from '@nestjs/common';

import { LodgeAccessService } from './lodge-access.service';
import { LodgesController } from './lodges.controller';
import { LodgesService } from './lodges.service';

@Module({
  controllers: [LodgesController],
  providers: [LodgesService, LodgeAccessService],
  exports: [LodgesService, LodgeAccessService],
})
export class LodgesModule {}
