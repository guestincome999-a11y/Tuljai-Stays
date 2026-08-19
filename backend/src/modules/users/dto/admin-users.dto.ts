import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdminUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @Type(() => Number)
  @IsOptional()
  @Min(1)
  page?: number;

  @Type(() => Number)
  @IsOptional()
  @Min(1)
  limit?: number;
}
