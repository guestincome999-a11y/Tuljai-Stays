import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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

const memberTypes = ['OWNER', 'STAFF'] as const;
// Same policy as the owner/staff password DTOs in auth.dto.ts.
const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

export class CreateTeamMemberDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsIn(memberTypes)
  memberType!: (typeof memberTypes)[number];

  @IsString()
  @MaxLength(120)
  name!: string;

  @Matches(passwordPattern, {
    message:
      'Password must be 8-72 characters and include at least one letter and one number.',
  })
  password!: string;

  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  roleTitle?: string;
}

export class UpdateTeamMemberDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  roleTitle?: string;
}
