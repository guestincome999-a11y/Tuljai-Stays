import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { BookingStatus } from '../../../../generated/prisma';

export class CreateBookingLockDto {
  @IsString()
  lodgeId!: string;

  @IsString()
  roomTypeId!: string;

  @IsDateString()
  checkInDate!: string;

  @IsDateString()
  checkOutDate!: string;
}

export class CreateBookingDto {
  @IsString()
  lockCode!: string;

  @IsString()
  @MaxLength(120)
  guestName!: string;

  @Matches(/^\+[1-9]\d{7,14}$/)
  guestPhone!: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  alternatePhone?: string;

  @IsEmail()
  @IsOptional()
  guestEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  guestAddress?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  numberOfAdults!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  numberOfChildren!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialRequest?: string;
}

export class RejectBookingDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status!: BookingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class BookingAvailabilityQueryDto {
  @IsDateString()
  checkInDate!: string;

  @IsDateString()
  checkOutDate!: string;
}

export class OwnerBookingsQueryDto {
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  lodgeId?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

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

export class AdminBookingsQueryDto {
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsString()
  lodgeId?: string;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

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
