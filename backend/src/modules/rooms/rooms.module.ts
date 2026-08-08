import { Module } from '@nestjs/common';

import { BookingsModule } from '../bookings/bookings.module';
import { LodgesModule } from '../lodges/lodges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';

import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [BookingsModule, LodgesModule, NotificationsModule, RealtimeModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
