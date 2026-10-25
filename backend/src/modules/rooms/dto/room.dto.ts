import { RoomStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Max,
  Min,
} from 'class-validator';

// Upper bound keeps a typo (e.g. an extra digit) from overflowing the price
// column and surfacing as an opaque 500 instead of a clear validation error.
const MAX_PRICE = 10_000_000;

export class CreateRoomTypeDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(140)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  capacityAdults!: number;

  @IsInt()
  @Min(0)
  capacityChildren!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PRICE)
  basePrice!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  @Max(MAX_PRICE)
  festivalPrice?: number;

  @IsInt()
  @Min(1)
  totalRooms!: number;
}

export class UpdateRoomTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  slug?: string;

  // null clears the description. @IsOptional skips validation for null.
  @IsOptional()
  @IsString()
  description?: string | null;

  @IsInt()
  @IsOptional()
  @Min(1)
  capacityAdults?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  capacityChildren?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  @Max(MAX_PRICE)
  basePrice?: number;

  // null clears the festival price. @IsOptional skips validation for null.
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  @Max(MAX_PRICE)
  festivalPrice?: number | null;

  // The admin panel allows 0 (every room of the type deactivated).
  @IsInt()
  @IsOptional()
  @Min(0)
  totalRooms?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateRoomDto {
  @IsString()
  @MaxLength(40)
  roomNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  floor?: string;
}

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  roomNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  floor?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRoomStatusDto {
  @IsEnum(RoomStatus)
  status!: RoomStatus;
}

export class CreateManualBookingDto {
  @IsDateString()
  checkInDate!: string;

  @IsDateString()
  checkOutDate!: string;

  @IsString()
  @MaxLength(120)
  guestName!: string;

  @Matches(/^\+[1-9]\d{7,14}$/)
  guestPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
