import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AssignLodgeOwnerDto {
  @IsString()
  userId!: string;

  @IsString()
  @MaxLength(120)
  ownerName!: string;

  @Matches(/^\+[1-9]\d{7,14}$/)
  ownerPhone!: string;

  @IsEmail()
  @IsOptional()
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  roleTitle?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
