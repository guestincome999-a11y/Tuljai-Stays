import { PropertyType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const CATALOG_SORTS = ['distance', 'name', 'price', 'rating'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  amenities?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  maxDistance?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsInt()
  @IsOptional()
  @Max(50)
  @Min(1)
  @Type(() => Number)
  pageSize?: number;

  @IsEnum(PropertyType)
  @IsOptional()
  propertyType?: PropertyType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsIn(CATALOG_SORTS)
  @IsOptional()
  sort?: CatalogSort;
}
