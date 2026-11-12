import { Module } from '@nestjs/common';

import { EmailService } from '../../shared/email/email.service';
import { LodgesModule } from '../lodges/lodges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

import { AdminBookingDetailController } from './admin-booking-detail.controller';
import { AdminBookingDetailService } from './admin-booking-detail.service';
import { BookingAvailabilityModule } from './booking-availability.module';
import { BookingDeliveryService } from './booking-delivery.service';
import { BookingHistoryService } from './booking-history.service';
import { BookingLocksService } from './booking-locks.service';
import { BookingSchedulerService } from './booking-scheduler.service';
import { BookingViewsController } from './booking-views.controller';
import { BookingViewsService } from './booking-views.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { GuestIdProofService } from './guest-id-proof.service';
import { GuestRegisterService } from './guest-register.service';
import { PrepaidBookingsController } from './prepaid-bookings.controller';
import { PrepaidBookingsService } from './prepaid-bookings.service';
import { QrCheckinService } from './qr-checkin.service';

@Module({
  imports: [LodgesModule, NotificationsModule, StorageModule, BookingAvailabilityModule],
  controllers: [
    AdminBookingDetailController,
    BookingViewsController,
    BookingsController,
    PrepaidBookingsController,
  ],
  providers: [
    EmailService,
    BookingDeliveryService,
    AdminBookingDetailService,
    BookingHistoryService,
    BookingLocksService,
    BookingSchedulerService,
    BookingViewsService,
    BookingsService,
    GuestIdProofService,
    GuestRegisterService,
    PrepaidBookingsService,
    QrCheckinService,
  ],
  exports: [
    BookingAvailabilityModule,
    BookingLocksService,
    BookingsService,
    GuestRegisterService,
    QrCheckinService,
    PrepaidBookingsService,
  ],
})
export class BookingsModule {}
