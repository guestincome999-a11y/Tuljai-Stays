import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class AdminUserSearchQueryDto {
  @IsString()
  @MaxLength(120)
  q!: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class AdminBookingUpdateDto {
  @IsOptional() @IsDateString() checkInDate?: string;
  @IsOptional() @IsDateString() checkOutDate?: string;
  @IsOptional() @IsString() @MaxLength(120) guestName?: string;
  @IsOptional() @Matches(/^\+[1-9]\d{7,14}$/) guestPhone?: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() @MaxLength(500) guestAddress?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) numberOfAdults?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(50) numberOfChildren?: number;
  @IsOptional() @IsString() @MaxLength(500) specialRequest?: string;
  @IsString() @MaxLength(500) notes!: string;
}
