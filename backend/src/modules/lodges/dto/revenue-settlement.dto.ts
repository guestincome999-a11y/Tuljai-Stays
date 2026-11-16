import { IsUUID, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

import { CreateCommissionSettlementDto } from './commission-settlement.dto';

export class CreateRevenueSettlementDto extends CreateCommissionSettlementDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankName?: string;

  @IsOptional()
  @Matches(/^\d{4}$/)
  accountLast4?: string;
}
