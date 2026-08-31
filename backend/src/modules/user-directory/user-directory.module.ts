import { Module } from '@nestjs/common';

import { AuditLogModule } from '../../shared/audit/audit-log.module';
import { PrismaModule } from '../prisma/prisma.module';

import { UserDirectoryController } from './user-directory.controller';
import { UserDirectoryService } from './user-directory.service';

@Module({
  controllers: [UserDirectoryController],
  exports: [UserDirectoryService],
  imports: [AuditLogModule, PrismaModule],
  providers: [UserDirectoryService],
})
export class UserDirectoryModule {}
