import { Allow, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSystemSettingDto {
  @Allow()
  value!: unknown;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class UpdateFeatureFlagDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;
}
