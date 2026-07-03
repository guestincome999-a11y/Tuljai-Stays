import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { RoomStatus } from '../../../../generated/prisma';

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
