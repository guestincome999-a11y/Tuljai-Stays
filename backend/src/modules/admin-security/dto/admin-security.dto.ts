import { IsString, Matches } from 'class-validator';

export class VerifyAdminTotpDto {
  @IsString()
  @Matches(/^\d{6}$/u)
  code!: string;
}
