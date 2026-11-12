import { Module } from '@nestjs/common';

import { BookingAvailabilityService } from './booking-availability.service';

@Module({ providers: [BookingAvailabilityService], exports: [BookingAvailabilityService] })
export class BookingAvailabilityModule {}
