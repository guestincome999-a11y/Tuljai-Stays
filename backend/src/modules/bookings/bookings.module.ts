import { Module } from '@nestjs/common';

import { LodgesModule } from '../lodges/lodges.module';

import { BookingAvailabilityService } from './booking-availability.service';
import { BookingHistoryService } from './booking-history.service';
import { BookingLocksService } from './booking-locks.service';
import { BookingSchedulerService } from './booking-scheduler.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [LodgesModule],
  controllers: [BookingsController],
  providers: [
    BookingAvailabilityService,
    BookingHistoryService,
    BookingLocksService,
    BookingSchedulerService,
    BookingsService,
  ],
  exports: [BookingAvailabilityService, BookingsService],
})
export class BookingsModule {}
