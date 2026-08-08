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
  Min,
} from 'class-validator';

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

  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
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

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  capacityAdults?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  capacityChildren?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  basePrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  festivalPrice?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
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
