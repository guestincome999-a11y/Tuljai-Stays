import { AmenityCategory } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateAmenityDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  iconName?: string;

  @IsEnum(AmenityCategory)
  category!: AmenityCategory;
}

export class AssignLodgeAmenitiesDto {
  @IsArray()
  @IsString({ each: true })
  amenityIds!: string[];
}
