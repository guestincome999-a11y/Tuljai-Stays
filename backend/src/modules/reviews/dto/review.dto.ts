import { ReviewReportReason, ReviewStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  bookingId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  cleanlinessRating?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  locationRating?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  serviceRating?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  valueRating?: number;
}

export class ReportReviewDto {
  @IsEnum(ReviewReportReason)
  reason!: ReviewReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class ListReviewsQueryDto {
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Max(100)
  @Min(1)
  limit?: number;

  @IsEnum(ReviewStatus)
  @IsOptional()
  status?: ReviewStatus;
}

export class ModerateReviewDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}

export class OwnerReviewResponseDto {
  @IsString()
  @MaxLength(2000)
  response!: string;
}
