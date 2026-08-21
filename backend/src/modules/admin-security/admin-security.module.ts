import { Module } from '@nestjs/common';

import { AuditLogModule } from '../../shared/audit/audit-log.module';

import { AdminSecurityController } from './admin-security.controller';
import { AdminSecurityService } from './admin-security.service';

@Module({
  imports: [AuditLogModule],
  controllers: [AdminSecurityController],
  providers: [AdminSecurityService],
})
export class AdminSecurityModule {}
