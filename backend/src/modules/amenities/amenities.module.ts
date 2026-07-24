import { Module } from '@nestjs/common';

import { LodgesModule } from '../lodges/lodges.module';

import { AmenitiesController } from './amenities.controller';
import { AmenitiesService } from './amenities.service';

@Module({
  imports: [LodgesModule],
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
