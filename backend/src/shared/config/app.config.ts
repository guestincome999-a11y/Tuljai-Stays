import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('api', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 4000),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTokenTtl: process.env.JWT_ACCESS_TOKEN_TTL ?? '15m',
    refreshTokenTtl: process.env.JWT_REFRESH_TOKEN_TTL ?? '30d',
  },
  otp: {
    ttlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
    rateLimitWindowSeconds: Number(process.env.OTP_RATE_LIMIT_WINDOW_SECONDS ?? 900),
    rateLimitMaxRequests: Number(process.env.OTP_RATE_LIMIT_MAX_REQUESTS ?? 5),
    allowDevResponse: process.env.ALLOW_DEV_OTP_RESPONSE === 'true',
  },
  booking: {
    lockTtlSeconds: Number(process.env.BOOKING_LOCK_TTL_SECONDS ?? 300),
    ownerResponseDeadlineSeconds: Number(
      process.env.BOOKING_OWNER_RESPONSE_DEADLINE_SECONDS ?? 120,
    ),
    commissionFlatAmount: process.env.BOOKING_COMMISSION_FLAT_AMOUNT
      ? Number(process.env.BOOKING_COMMISSION_FLAT_AMOUNT)
      : null,
    schedulerIntervalSeconds: Number(process.env.BOOKING_SCHEDULER_INTERVAL_SECONDS ?? 60),
    qrTokenTtlSeconds: Number(process.env.BOOKING_QR_TOKEN_TTL_SECONDS ?? 86400),
    showOwnerPhoneAfterAccepted: process.env.BOOKING_SHOW_OWNER_PHONE_AFTER_ACCEPTED === 'true',
  },
  fcm: {
    projectId: process.env.FCM_PROJECT_ID,
    clientEmail: process.env.FCM_CLIENT_EMAIL,
    privateKey: process.env.FCM_PRIVATE_KEY,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'tuljai-stays',
  },
}));
