import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class CreatePromoCodeDto {
  @Matches(/^[A-Z0-9_-]{3,32}$/u)
  code!: string;
  @IsIn(['FLAT', 'PERCENTAGE'] as const)
  discountType!: 'FLAT' | 'PERCENTAGE';
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  discountValue!: number;
  @IsDateString()
  startsAt!: string;
  @IsDateString()
  endsAt!: string;
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;
  @IsOptional()
  @IsUUID()
  lodgeId?: string;
}
export class ValidatePromoCodeDto {
  @Matches(/^[A-Z0-9_-]{3,32}$/u)
  code!: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal!: number;
  @IsUUID()
  lodgeId!: string;
}
