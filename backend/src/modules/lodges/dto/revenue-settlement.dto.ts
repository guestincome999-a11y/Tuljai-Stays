import { IsUUID } from 'class-validator';

import { CreateCommissionSettlementDto } from './commission-settlement.dto';

export class CreateRevenueSettlementDto extends CreateCommissionSettlementDto {
  @IsUUID()
  idempotencyKey!: string;
}
