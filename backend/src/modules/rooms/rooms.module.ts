import { Module } from '@nestjs/common';

import { LodgesModule } from '../lodges/lodges.module';

import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [LodgesModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
