import { Module } from '@nestjs/common';

import { LodgesModule } from '../lodges/lodges.module';
import { RealtimeModule } from '../realtime/realtime.module';

import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [LodgesModule, RealtimeModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
