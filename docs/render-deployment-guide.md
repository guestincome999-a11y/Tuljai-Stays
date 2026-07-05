# Render Deployment Guide

## Deployment Order

1. Create PostgreSQL.
2. Deploy backend API.
3. Deploy admin panel.
4. Configure mobile apps with the production API URL.

## PostgreSQL

- Create a Render PostgreSQL instance.
- Copy the internal database URL into backend `DATABASE_URL`.
- Enable automated backups if available on the chosen tier.
- Run migrations against staging first, then production.

## Backend Web Service

Recommended settings:

- Root directory: repository root
- Build command: `npm ci && npm run db:generate && npm run build:backend`
- Start command: `npm run start:backend`
- Health check path: `/api/health`

Required environment:

- `NODE_ENV=production`
- `API_PORT` or Render-compatible port mapping
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ALLOWED_ORIGINS`
- `ALLOW_DEV_OTP_RESPONSE=false`
- FCM and Supabase variables when those services are enabled

Migration command before release:

```bash
npm run db:deploy
```

## Admin Panel Web Service

Recommended settings:

- Root directory: repository root
- Build command: `npm ci && npm run build:admin`
- Start command: `npm run start:admin`
- Environment: `NEXT_PUBLIC_API_BASE_URL=https://YOUR_BACKEND_HOST`

## Common Render Issues

- Wrong port: ensure Render exposes a port compatible with `API_PORT`.
- Missing generated Prisma client: run `npm run db:generate` before backend build.
- Missing allowed origins: production backend startup fails without `ALLOWED_ORIGINS`.
- Placeholder JWT secrets: production backend startup fails for weak or placeholder JWT secrets.
- Database migration missing: backend may start but fail at runtime if schema is older than code.

## Rollback Steps

- Use Render deploy history to roll backend/admin back to the previous successful deploy.
- Do not roll back database schema blindly after migrations.
- Use feature flags for emergency behavior rollback.
- Restore database only when data corruption or destructive migration failure is confirmed.
