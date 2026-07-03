import { Module } from '@nestjs/common';

import { FcmService } from './providers/fcm.service';

@Module({
  providers: [FcmService],
  exports: [FcmService],
})
export class NotificationsModule {}
