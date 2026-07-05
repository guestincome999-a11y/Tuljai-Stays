# Tuljai Stays Environment Variables

## Rules

- Never commit real secrets.
- Keep production secrets only in the hosting provider environment.
- Public app variables may contain URLs, but never private keys, service role keys, JWT secrets, OTPs, or database URLs.
- Production backend must use `NODE_ENV=production` and explicit `ALLOWED_ORIGINS`.

## Backend

| Variable                                  | Required               | Local Example                                 | Production Guidance                                                                 |
| ----------------------------------------- | ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `NODE_ENV`                                | Yes                    | `development`                                 | `production`                                                                        |
| `API_PORT`                                | Yes                    | `4000`                                        | Render usually provides `PORT`; map it to `API_PORT` if needed.                     |
| `PORT`                                    | Render                 | `4000`                                        | Render platform port. The app currently reads `API_PORT`.                           |
| `APP_ENV`                                 | Optional               | `local`                                       | Operational label if deployment tooling needs one.                                  |
| `ALLOWED_ORIGINS`                         | Production             | `http://localhost:3000,http://localhost:8081` | Comma-separated admin and app web origins. Never use wildcard in production.        |
| `API_BODY_LIMIT_BYTES`                    | No                     | `1048576`                                     | Keep conservative unless uploads move through signed storage URLs.                  |
| `DATABASE_URL`                            | Yes                    | Local PostgreSQL URL                          | Render PostgreSQL internal connection string.                                       |
| `JWT_ACCESS_SECRET`                       | Yes                    | Local dummy only                              | Strong secret, at least 32 characters.                                              |
| `JWT_REFRESH_SECRET`                      | Yes                    | Local dummy only                              | Strong secret, at least 32 characters.                                              |
| `JWT_ACCESS_TOKEN_TTL`                    | No                     | `15m`                                         | Short-lived access token duration.                                                  |
| `JWT_REFRESH_TOKEN_TTL`                   | No                     | `30d`                                         | Refresh token duration.                                                             |
| `OTP_TTL_SECONDS`                         | No                     | `300`                                         | OTP validity window.                                                                |
| `OTP_MAX_ATTEMPTS`                        | No                     | `5`                                           | Maximum verification attempts per OTP request.                                      |
| `OTP_RATE_LIMIT_WINDOW_SECONDS`           | No                     | `900`                                         | OTP request rate-limit window.                                                      |
| `OTP_RATE_LIMIT_MAX_REQUESTS`             | No                     | `5`                                           | Max OTP requests per phone and purpose in the window.                               |
| `ALLOW_DEV_OTP_RESPONSE`                  | No                     | `false`                                       | Must remain `false` in production.                                                  |
| `OTP_DEV_MODE`                            | Legacy alias           | `false`                                       | Do not use for production; current code uses `ALLOW_DEV_OTP_RESPONSE`.              |
| `BOOKING_LOCK_TTL_SECONDS`                | No                     | `300`                                         | Current code variable for booking lock duration.                                    |
| `BOOKING_LOCK_DURATION_SECONDS`           | Legacy alias           | `300`                                         | Documented alias only; current code uses `BOOKING_LOCK_TTL_SECONDS`.                |
| `BOOKING_OWNER_RESPONSE_DEADLINE_SECONDS` | No                     | `120`                                         | Current code variable for owner response timeout.                                   |
| `OWNER_RESPONSE_TIMEOUT_SECONDS`          | Legacy alias           | `120`                                         | Documented alias only; current code uses `BOOKING_OWNER_RESPONSE_DEADLINE_SECONDS`. |
| `BOOKING_QR_TOKEN_TTL_SECONDS`            | No                     | `86400`                                       | QR token validity window.                                                           |
| `BOOKING_COMMISSION_FLAT_AMOUNT`          | No                     | Empty                                         | Optional commission foundation.                                                     |
| `BOOKING_SCHEDULER_INTERVAL_SECONDS`      | No                     | `60`                                          | Background scheduler interval.                                                      |
| `BOOKING_SHOW_OWNER_PHONE_AFTER_ACCEPTED` | No                     | `false`                                       | Privacy-sensitive display flag.                                                     |
| `FCM_PROJECT_ID`                          | Optional until push    | Empty                                         | Firebase project ID.                                                                |
| `FIREBASE_PROJECT_ID`                     | Legacy name            | Empty                                         | Use `FCM_PROJECT_ID` in current code.                                               |
| `FCM_CLIENT_EMAIL`                        | Optional until push    | Empty                                         | Firebase service account email.                                                     |
| `FIREBASE_CLIENT_EMAIL`                   | Legacy name            | Empty                                         | Use `FCM_CLIENT_EMAIL` in current code.                                             |
| `FCM_PRIVATE_KEY`                         | Optional until push    | Empty                                         | Firebase service account private key.                                               |
| `FIREBASE_PRIVATE_KEY`                    | Legacy name            | Empty                                         | Use `FCM_PRIVATE_KEY` in current code.                                              |
| `SUPABASE_URL`                            | Optional until storage | Empty                                         | Supabase project URL.                                                               |
| `SUPABASE_SERVICE_ROLE_KEY`               | Optional until storage | Empty                                         | Backend-only service role key.                                                      |
| `SUPABASE_STORAGE_BUCKET`                 | No                     | `tuljai-stays`                                | Storage bucket name.                                                                |

## Admin Panel

| Variable                   | Required | Local Example           | Production Guidance                                                                                |
| -------------------------- | -------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes      | `http://localhost:4000` | Public backend URL, preferably without trailing `/api` because the shared client normalizes paths. |

## Pilgrim App

| Variable                   | Required | Local Example               | Production Guidance                                                               |
| -------------------------- | -------- | --------------------------- | --------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL` | Yes      | `http://localhost:4000/api` | Production HTTPS backend API URL. Expo public variables are bundled into the app. |

## Owner App

| Variable                   | Required | Local Example               | Production Guidance                                                            |
| -------------------------- | -------- | --------------------------- | ------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_API_BASE_URL` | Yes      | `http://localhost:4000/api` | Production HTTPS backend API URL. Required for QR scanner and owner workflows. |
