import { Module } from '@nestjs/common';

import { LodgesModule } from '../lodges/lodges.module';

import { BookingAvailabilityService } from './booking-availability.service';
import { BookingHistoryService } from './booking-history.service';
import { BookingLocksService } from './booking-locks.service';
import { BookingSchedulerService } from './booking-scheduler.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { GuestRegisterService } from './guest-register.service';
import { QrCheckinService } from './qr-checkin.service';

@Module({
  imports: [LodgesModule],
  controllers: [BookingsController],
  providers: [
    BookingAvailabilityService,
    BookingHistoryService,
    BookingLocksService,
    BookingSchedulerService,
    BookingsService,
    GuestRegisterService,
    QrCheckinService,
  ],
  exports: [BookingAvailabilityService, BookingsService, GuestRegisterService, QrCheckinService],
})
export class BookingsModule {}
