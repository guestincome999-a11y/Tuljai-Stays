import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsInt()
  @Min(1)
  API_PORT: number = 4000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TOKEN_TTL?: string;

  @IsOptional()
  @IsString()
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
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
