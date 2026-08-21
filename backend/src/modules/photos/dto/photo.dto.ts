import { PhotoCategory } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateLodgePhotoDto {
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsEnum(PhotoCategory)
  category!: PhotoCategory;

  @IsUrl({ require_tld: false })
  fileUrl!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  thumbnailUrl?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isCover?: boolean;
}

export class RejectPhotoDto {
  @IsString()
  rejectionReason!: string;
}
