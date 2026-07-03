import { Module } from '@nestjs/common';

import { LodgesModule } from '../lodges/lodges.module';
import { RealtimeModule } from '../realtime/realtime.module';

import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [LodgesModule, RealtimeModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
