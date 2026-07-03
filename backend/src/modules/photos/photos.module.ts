import { Module } from '@nestjs/common';

import { LodgesModule } from '../lodges/lodges.module';

import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [LodgesModule],
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}
