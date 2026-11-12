import { Module } from '@nestjs/common';

import { BookingAvailabilityModule } from '../bookings/booking-availability.module';
import { LodgesModule } from '../lodges/lodges.module';

import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [BookingAvailabilityModule, LodgesModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
