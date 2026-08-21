import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum LodgeCommissionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_PER_BOOKING = 'FIXED_PER_BOOKING',
}

export class UpdateLodgeCommissionDto {
  @IsBoolean()
  commissionEnabled!: boolean;

  @IsEnum(LodgeCommissionType)
  commissionType!: LodgeCommissionType;

  @ValidateIf(
    (dto: UpdateLodgeCommissionDto) => dto.commissionType === LodgeCommissionType.PERCENTAGE,
  )
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRatePercent?: number;

  @ValidateIf(
    (dto: UpdateLodgeCommissionDto) => dto.commissionType === LodgeCommissionType.FIXED_PER_BOOKING,
  )
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commissionFixedAmount?: number;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;
}
