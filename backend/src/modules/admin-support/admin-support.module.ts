import { Module } from '@nestjs/common';

import { AuditLogModule } from '../../shared/audit/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';

import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';

@Module({
  imports: [AuditLogModule, NotificationsModule, PrismaModule, RealtimeModule],
  controllers: [AdminSupportController],
  providers: [AdminSupportService],
  exports: [AdminSupportService],
})
export class AdminSupportModule {}
