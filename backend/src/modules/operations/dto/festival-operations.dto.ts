import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class FestivalQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) checkInDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) checkOutDate?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(['all', 'active', 'disabled', 'full', 'empty']) filter?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
}

export class FestivalModeDto {
  @IsBoolean() enabled!: boolean;
  @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @IsString() @Matches(/^(\d{4}-\d{2}-\d{2})?$/) startDate!: string;
  @IsString() @Matches(/^(\d{4}-\d{2}-\d{2})?$/) endDate!: string;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
  // Empty only for an as-yet unconfigured flag. A stale form cannot overwrite another admin.
  @IsString() @MaxLength(40) expectedUpdatedAt!: string;
}

export class LodgeOperationDto {
  @IsBoolean() isActive!: boolean;
  @IsIn([
    'Fully booked',
    'Owner temporarily unavailable',
    'Maintenance',
    'Operational issue',
    'Emergency closure',
    'Other',
  ])
  reason!: string;
  @IsString() @MinLength(5) @MaxLength(500) detail!: string;
  @IsDateString() expectedUpdatedAt!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkInDate!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkOutDate!: string;
}

export class RecoveryReasonDto {
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class ManualCheckinDto extends RecoveryReasonDto {
  // Legacy callers may provide the internal ID; staff only need the printed booking code.
  @IsOptional() @IsUUID() bookingId?: string;
  @IsString() @MinLength(5) @MaxLength(100) bookingCode!: string;
  @IsString() @Matches(/^\+?[0-9 ()-]{10,20}$/) guestPhone!: string;
}
