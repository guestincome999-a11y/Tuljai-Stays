# Database Migration Guide

## Current State

The Prisma schema exists at `backend/prisma/schema.prisma`. A migrations directory is not yet present, so the first production release must create a proper baseline migration before deployment.

## Local Migration Flow

```bash
npm run db:generate
npm run db:migrate
```

Use local development data only. Never point local migration commands at production.

## Production Migration Flow

1. Backup production PostgreSQL.
2. Apply the same migration to staging.
3. Run smoke tests on staging.
4. Deploy backend code.
5. Run:

```bash
npm run db:deploy
```

6. Verify `/api/health` and core workflows.

## Rollback Guidance

- Prefer forward-only corrective migrations.
- Never run destructive reset commands in production.
- Do not use `prisma migrate reset` against staging-like or production data.
- If rollback is required after data loss, stop writes, restore the database backup, and redeploy the matching application version.

## Seeding

Use:

```bash
npm run db:seed
```

Only seed production-safe defaults. Do not seed test users, OTPs, guest details, or fake bookings into production.

## Destructive Migration Review

Before any production migration:

- Check for dropped columns or tables.
- Check enum changes against existing data.
- Check nullable-to-required changes.
- Confirm indexes are safe to create on current table sizes.
- Confirm backup completion and restore test status.
