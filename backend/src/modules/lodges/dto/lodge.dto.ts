import { LodgeStatus, PropertyType, VerificationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class LodgeAddressDto {
  @IsString()
  @MaxLength(200)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @IsString()
  city!: string;

  @IsString()
  district!: string;

  @IsString()
  state!: string;

  @IsString()
  @MaxLength(12)
  pincode!: string;

  @IsString()
  country!: string;
}

export class CreateLodgeDto {
  @IsString()
  cityId!: string;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PropertyType)
  propertyType!: PropertyType;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @Matches(/^\+[1-9]\d{7,14}$/)
  primaryPhone!: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  secondaryPhone?: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  whatsappNumber?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  distanceFromTempleMeters?: number;

  @IsNumber()
  @IsOptional()
  @Max(90)
  @Min(-90)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Max(180)
  @Min(-180)
  longitude?: number;

  @IsOptional()
  @IsString()
  checkInTime?: string;

  @IsOptional()
  @IsString()
  checkOutTime?: string;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LodgeAddressDto)
  address?: LodgeAddressDto;
}

export class UpdateLodgeDto {
  @IsString()
  @IsOptional()
  cityId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PropertyType)
  @IsOptional()
  propertyType?: PropertyType;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  primaryPhone?: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  secondaryPhone?: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  whatsappNumber?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  distanceFromTempleMeters?: number;

  @IsNumber()
  @IsOptional()
  @Max(90)
  @Min(-90)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Max(180)
  @Min(-180)
  longitude?: number;

  @IsOptional()
  @IsString()
  checkInTime?: string;

  @IsOptional()
  @IsString()
  checkOutTime?: string;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LodgeAddressDto)
  address?: LodgeAddressDto;
}

export class UpdateLodgeStatusDto {
  @IsEnum(LodgeStatus)
  status!: LodgeStatus;
}

export class VerifyLodgeDto {
  @IsEnum(VerificationStatus)
  verificationStatus!: VerificationStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListLodgesQueryDto {
  @IsOptional()
  @IsString()
  citySlug?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsEnum(PropertyType)
  @IsOptional()
  propertyType?: PropertyType;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number;
}

export class BulkImportLodgeRowDto {
  @IsInt()
  @Min(2)
  rowNumber!: number;

  @IsString()
  citySlug!: string;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PropertyType)
  propertyType!: PropertyType;

  @Matches(/^\+[1-9]\d{7,14}$/)
  primaryPhone!: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  secondaryPhone?: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  whatsappNumber?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  distanceFromTempleMeters?: number;

  @IsNumber()
  @IsOptional()
  @Max(90)
  @Min(-90)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Max(180)
  @Min(-180)
  longitude?: number;

  @IsOptional()
  @IsString()
  checkInTime?: string;

  @IsOptional()
  @IsString()
  checkOutTime?: string;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => LodgeAddressDto)
  address!: LodgeAddressDto;

  @Matches(/^\+[1-9]\d{7,14}$/)
  ownerPhone!: string;

  @IsEmail()
  @IsOptional()
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ownerRoleTitle?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  amenitySlugs?: string[];

  @IsBoolean()
  @IsOptional()
  publishLive?: boolean;
}

export class BulkImportLodgesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkImportLodgeRowDto)
  rows!: BulkImportLodgeRowDto[];
}
