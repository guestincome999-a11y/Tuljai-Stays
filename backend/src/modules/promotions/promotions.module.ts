import { Module } from '@nestjs/common';

import { AuditLogModule } from '../../shared/audit/audit-log.module';

import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [AuditLogModule],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
