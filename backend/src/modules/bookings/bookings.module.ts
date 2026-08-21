import { Module } from '@nestjs/common';

import { LodgesModule } from '../lodges/lodges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

import { BookingAvailabilityService } from './booking-availability.service';
import { BookingHistoryService } from './booking-history.service';
import { BookingLocksService } from './booking-locks.service';
import { BookingSchedulerService } from './booking-scheduler.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { GuestIdProofService } from './guest-id-proof.service';
import { GuestRegisterService } from './guest-register.service';
import { PrepaidBookingsController } from './prepaid-bookings.controller';
import { PrepaidBookingsService } from './prepaid-bookings.service';
import { QrCheckinService } from './qr-checkin.service';

@Module({
  imports: [LodgesModule, NotificationsModule, StorageModule],
  controllers: [BookingsController, PrepaidBookingsController],
  providers: [
    BookingAvailabilityService,
    BookingHistoryService,
    BookingLocksService,
    BookingSchedulerService,
    BookingsService,
    GuestIdProofService,
    GuestRegisterService,
    PrepaidBookingsService,
    QrCheckinService,
  ],
  exports: [BookingAvailabilityService, BookingsService, GuestRegisterService, QrCheckinService, PrepaidBookingsService],
})
export class BookingsModule {}
