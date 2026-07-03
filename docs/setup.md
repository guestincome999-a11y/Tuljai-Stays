# Setup

## Requirements

- Node.js 22 LTS or newer.
- npm 10 or newer.
- PostgreSQL 16 or compatible managed PostgreSQL.

## Install

```bash
npm install
```

## Environment

Copy the example files and fill local values:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp apps/pilgrim-app/.env.example apps/pilgrim-app/.env
cp apps/owner-app/.env.example apps/owner-app/.env
cp apps/admin-panel/.env.local.example apps/admin-panel/.env.local
```

## Database

Generate Prisma client:

```bash
npm run db:generate
```

Create the initial migration after PostgreSQL is available:

```bash
npm run db:migrate
```

## Verification

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
```
