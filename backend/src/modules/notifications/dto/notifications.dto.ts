import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  AnnouncementCategory,
  AnnouncementTargetAudience,
  NotificationPriority,
  NotificationType,
} from '../../../../generated/prisma';

export class ListNotificationsQueryDto {
  @IsBooleanString()
  @IsOptional()
  unreadOnly?: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

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

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(2000)
  body!: string;

  @IsEnum(AnnouncementCategory)
  category!: AnnouncementCategory;

  @IsEnum(NotificationPriority)
  priority!: NotificationPriority;

  @IsEnum(AnnouncementTargetAudience)
  targetAudience!: AnnouncementTargetAudience;

  @IsOptional()
  @IsString()
  targetCityId?: string;

  @IsOptional()
  @IsString()
  targetLodgeId?: string;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class ListAnnouncementsQueryDto {
  @IsBooleanString()
  @IsOptional()
  unreadOnly?: string;

  @IsEnum(AnnouncementCategory)
  @IsOptional()
  category?: AnnouncementCategory;

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

export class UpdateAnnouncementDto extends CreateAnnouncementDto {}
