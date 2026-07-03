import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

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
  deviceId!: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  fcmToken?: string;

  @Matches(/^\d{4,8}$/)
  otp!: string;

  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;

  @IsIn(platforms)
  platform!: (typeof platforms)[number];
}

export class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  deviceId!: string;

  @IsNotEmpty()
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @IsBoolean()
  @IsOptional()
  deactivateDeviceToken?: boolean;

  @IsNotEmpty()
  @IsString()
  deviceId!: string;

  @IsNotEmpty()
  @IsString()
  refreshToken!: string;
}

export class RegisterDeviceTokenDto {
  @IsIn(appTypes)
  appType!: (typeof appTypes)[number];

  @IsNotEmpty()
  @IsString()
  deviceId!: string;

  @IsNotEmpty()
  @IsString()
  fcmToken!: string;

  @IsIn(platforms)
  platform!: (typeof platforms)[number];
}
