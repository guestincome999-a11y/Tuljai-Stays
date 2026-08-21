import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const appTypes = ['PILGRIM_APP', 'OWNER_APP', 'ADMIN_PANEL'] as const;
const otpPurposes = ['LOGIN', 'REGISTER', 'VERIFY_PHONE'] as const;
const platforms = ['ANDROID', 'IOS', 'WEB', 'UNKNOWN'] as const;

export class RequestOtpDto {
  @IsIn(appTypes)
  appType!: (typeof appTypes)[number];

  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;

  @IsIn(otpPurposes)
  purpose!: (typeof otpPurposes)[number];
}

export class VerifyOtpDto {
  @IsIn(appTypes)
  appType!: (typeof appTypes)[number];

  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  deviceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  fcmToken?: string;

  @Matches(/^\d{4,8}$/)
  otp!: string;

  @IsOptional()
  @Matches(/^\d{6}$/u)
  totpCode?: string;

  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;

  @IsIn(platforms)
  platform!: (typeof platforms)[number];
}

export class GoogleLoginDto {
  @IsIn(['PILGRIM_APP'] as const)
  appType!: 'PILGRIM_APP';

  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  deviceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  fcmToken?: string;

  @IsIn(platforms)
  platform!: (typeof platforms)[number];

  @IsNotEmpty()
  @IsString()
  @MaxLength(8192)
  supabaseAccessToken!: string;
}

export class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  deviceId!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(256)
  refreshToken!: string;
}

export class LogoutDto {
  @IsBoolean()
  @IsOptional()
  deactivateDeviceToken?: boolean;

  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  deviceId!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(256)
  refreshToken!: string;
}

export class RegisterDeviceTokenDto {
  @IsIn(appTypes)
  appType!: (typeof appTypes)[number];

  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  deviceId!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(4096)
  fcmToken!: string;

  @IsIn(platforms)
  platform!: (typeof platforms)[number];
}

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;
}
