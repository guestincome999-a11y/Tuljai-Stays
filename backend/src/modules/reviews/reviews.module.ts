import { Module } from '@nestjs/common';

import { LodgesModule } from '../lodges/lodges.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [LodgesModule, NotificationsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
