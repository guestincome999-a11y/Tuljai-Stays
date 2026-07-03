import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { GuestIdType, GuestRegisterStatus } from '../../../../generated/prisma';

export class GenerateQrDto {
  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(604800)
  ttlSeconds?: number;
}

export class ScanQrDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;
}

export class RegisterQueryDto {
  @IsOptional()
  @IsString()
  lodgeId?: string;

  @IsEnum(GuestRegisterStatus)
  @IsOptional()
  status?: GuestRegisterStatus;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bookingCode?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class MarkIdVerifiedDto {
  @IsEnum(GuestIdType)
  @IsOptional()
  governmentIdType?: GuestIdType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  governmentIdNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  documentHolderName?: string;
}

export class UpdateRegisterNotesDto {
  @IsString()
  @MaxLength(1000)
  ownerNotes!: string;
}
