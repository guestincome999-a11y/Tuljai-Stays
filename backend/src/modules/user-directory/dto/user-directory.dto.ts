import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UserDirectoryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(['PILGRIM', 'OWNER', 'ADMIN', 'SUPER_ADMIN'])
  role?: 'PILGRIM' | 'OWNER' | 'ADMIN' | 'SUPER_ADMIN';

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

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

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive!: boolean;

  @IsString()
  @MaxLength(500)
  reason!: string;
}
