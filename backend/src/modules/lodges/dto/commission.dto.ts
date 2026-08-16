import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateLodgeCommissionDto {
  @IsBoolean()
  commissionEnabled!: boolean;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRatePercent!: number;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;
}
