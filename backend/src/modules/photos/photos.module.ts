import { Module } from '@nestjs/common';

import { LodgesModule } from '../lodges/lodges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [LodgesModule, NotificationsModule, StorageModule],
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}
