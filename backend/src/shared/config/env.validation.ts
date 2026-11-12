import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsInt()
  @Min(1)
  API_PORT: number = 4000;

  @IsOptional()
  @IsString()
  API_HOST?: string;

  @IsOptional()
  @IsString()
  ALLOWED_ORIGINS?: string;

  @IsOptional()
  @IsInt()
  @Min(1024)
  API_BODY_LIMIT_BYTES?: number;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @Matches(/^[1-9]\d*[smhd]?$/)
  JWT_ACCESS_TOKEN_TTL?: string;

  @IsOptional()
  @Matches(/^[1-9]\d*[smhd]?$/)
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @Matches(/^[1-9]\d*[smhd]?$/)
  JWT_REFRESH_EXPIRES_IN?: string;

  @IsInt()
  @Min(1)
  AUTH_SESSION_MAX_AGE_DAYS: number = 180;

  @IsOptional()
  @Matches(/^[1-9]\d*[smhd]?$/)
  JWT_REFRESH_TOKEN_TTL?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  OTP_TTL_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  OTP_MAX_ATTEMPTS?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  OTP_RATE_LIMIT_WINDOW_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  OTP_RATE_LIMIT_MAX_REQUESTS?: number;

  @IsOptional()
  @IsString()
  ALLOW_DEV_OTP_RESPONSE?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  BOOKING_LOCK_TTL_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  BOOKING_OWNER_RESPONSE_DEADLINE_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  BOOKING_COMMISSION_FLAT_AMOUNT?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  BOOKING_SCHEDULER_INTERVAL_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(300)
  BOOKING_QR_TOKEN_TTL_SECONDS?: number;

  @IsOptional()
  @IsString()
  BOOKING_SHOW_OWNER_PHONE_AFTER_ACCEPTED?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  OWNER_PASSWORD_RESET_TTL_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  OWNER_PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  OWNER_PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS?: number;

  @IsOptional()
  @IsString()
  OWNER_PASSWORD_RESET_DEEP_LINK?: string;

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  SMTP_PORT?: number;

  @IsOptional()
  @IsString()
  SMTP_SECURE?: string;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsOptional()
  @IsString()
  SMTP_FROM?: string;

  @IsOptional()
  @IsIn(['gmail', 'smtp'])
  EMAIL_PROVIDER?: string;

  @IsOptional()
  @IsString()
  GMAIL_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GMAIL_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  GMAIL_REFRESH_TOKEN?: string;

  @IsOptional()
  @IsString()
  EMAIL_FROM_NAME?: string;

  @IsOptional()
  @IsEmail()
  EMAIL_FROM_ADDRESS?: string;

  @IsOptional()
  @IsEmail()
  EMAIL_SUPPORT_ADDRESS?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  BOOKING_EMAIL_ENABLED?: string;

  @IsOptional()
  @IsString()
  BOOKING_EMAIL_ALLOWED_RECIPIENTS?: string;

  @IsOptional()
  @Matches(/^https:\/\//u)
  BOOKING_WEB_URL_TEMPLATE?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  BOOKING_QR_OPAQUE_ENABLED?: string;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  if (validatedConfig.BOOKING_EMAIL_ENABLED === 'true') {
    if (!validatedConfig.EMAIL_FROM_ADDRESS)
      throw new Error('Booking email requires EMAIL_FROM_ADDRESS');
    if (validatedConfig.EMAIL_PROVIDER === 'gmail') {
      if (
        !validatedConfig.GMAIL_CLIENT_ID ||
        !validatedConfig.GMAIL_CLIENT_SECRET ||
        !validatedConfig.GMAIL_REFRESH_TOKEN
      )
        throw new Error(
          'Gmail API requires GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN',
        );
    } else if (
      !validatedConfig.SMTP_HOST ||
      !validatedConfig.SMTP_USER ||
      !validatedConfig.SMTP_PASS
    )
      throw new Error('SMTP email requires SMTP_HOST, SMTP_USER and SMTP_PASS');
  }

  validateProductionSecurity(validatedConfig);

  return validatedConfig;
}

function validateProductionSecurity(config: EnvironmentVariables): void {
  if (config.NODE_ENV !== 'production') {
    return;
  }

  if (!config.ALLOWED_ORIGINS?.trim()) {
    throw new Error('ALLOWED_ORIGINS must be configured in production.');
  }

  if (config.ALLOW_DEV_OTP_RESPONSE === 'true') {
    throw new Error('ALLOW_DEV_OTP_RESPONSE must not be enabled in production.');
  }

  assertProductionSecret('JWT_ACCESS_SECRET', config.JWT_ACCESS_SECRET);
  assertProductionSecret('JWT_REFRESH_SECRET', config.JWT_REFRESH_SECRET);
}

function assertProductionSecret(name: string, value: string): void {
  if (value.length < 32 || value.toLowerCase().includes('change-me')) {
    throw new Error(`${name} must be a strong production secret.`);
  }
}
