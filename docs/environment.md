# Environment Variables

## Root and Backend

- `NODE_ENV` - `development`, `test`, or `production`.
- `API_PORT` - backend HTTP port.
- `DATABASE_URL` - PostgreSQL connection string.
- `JWT_ACCESS_SECRET` - access token signing secret.
- `JWT_REFRESH_SECRET` - refresh token signing secret.
- `JWT_ACCESS_TOKEN_TTL` - access token lifetime.
- `JWT_REFRESH_TOKEN_TTL` - refresh token lifetime.
- `OTP_TTL_SECONDS` - OTP lifetime in seconds.
- `OTP_MAX_ATTEMPTS` - maximum OTP verification attempts.
- `OTP_RATE_LIMIT_WINDOW_SECONDS` - OTP request rate-limit window.
- `OTP_RATE_LIMIT_MAX_REQUESTS` - maximum OTP requests per phone and purpose within the window.
- `ALLOW_DEV_OTP_RESPONSE` - development-only switch for returning OTPs in API responses.
- `FCM_PROJECT_ID` - Firebase project identifier.
- `FCM_CLIENT_EMAIL` - Firebase service account client email.
- `FCM_PRIVATE_KEY` - Firebase service account private key.
- `SUPABASE_URL` - Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key for backend-only use.
- `SUPABASE_STORAGE_BUCKET` - storage bucket name.

## Public Apps

- `EXPO_PUBLIC_API_BASE_URL` - API base URL for Expo apps.
- `NEXT_PUBLIC_API_BASE_URL` - API base URL for the admin panel.

Public variables must not contain secrets.
