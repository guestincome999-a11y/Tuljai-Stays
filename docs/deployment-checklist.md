# Deployment Checklist

## Pre-Deploy

- Typecheck passed.
- Lint passed.
- Build passed.
- Format check passed.
- Security checklist passed.
- Database migration tested on staging.
- Production environment variables configured.
- Backup completed.
- Rollback plan reviewed.

## Backend

- `DATABASE_URL` set.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are strong.
- `ALLOWED_ORIGINS` contains only approved origins.
- `ALLOW_DEV_OTP_RESPONSE=false`.
- FCM variables configured if push is enabled.
- Supabase variables configured if storage is enabled.
- `/api/health` returns `status: ok`.

## Admin Panel

- `NEXT_PUBLIC_API_BASE_URL` points to production backend.
- Admin login works.
- Admin dashboard loads.
- Live operations connection works.

## Mobile

- Pilgrim app points to production API.
- Owner app points to production API.
- Owner camera permission works.
- QR scan flow tested on physical device.
- Push notification registration tested on physical device.

## Post-Deploy Smoke Tests

- Health check passes.
- Admin login works.
- Lodge discovery works.
- Booking lifecycle smoke test passes.
- QR generation and scan pass.
- Notifications tested.
- Rollback route remains available.
