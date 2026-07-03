# Tuljai Stays

Tuljai Stays is a lodging and Bhakt Niwas platform for pilgrims visiting Tuljapur.

This repository is initialized as a TypeScript monorepo with separate applications for pilgrims, property owners, administration, and the backend API. The current state is a production-oriented foundation only; booking, QR, notification workflows, payments, and other business modules are intentionally not implemented yet.

## Workspace Layout

- `apps/pilgrim-app` - Expo React Native application for pilgrims.
- `apps/owner-app` - Expo React Native application for accommodation owners.
- `apps/admin-panel` - Next.js administration panel.
- `backend` - NestJS API with Prisma, Socket.IO, FCM, and Supabase foundations.
- `packages/ui` - shared Material Design 3 theme tokens and UI primitives.
- `packages/shared` - shared constants, environment helpers, and Axios API client foundation.
- `packages/types` - cross-platform TypeScript contracts.
- `packages/utils` - framework-neutral utility, logging, and error helpers.
- `docs` - architecture and setup documentation.
- `scripts` - repository automation scripts.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment examples:

   ```bash
   cp .env.example .env
   cp apps/pilgrim-app/.env.example apps/pilgrim-app/.env
   cp apps/owner-app/.env.example apps/owner-app/.env
   cp apps/admin-panel/.env.example apps/admin-panel/.env.local
   cp backend/.env.example backend/.env
   ```

3. Generate Prisma client:

   ```bash
   npm run db:generate
   ```

4. Run verification:

   ```bash
   npm run typecheck
   npm run lint
   ```

## Development Commands

- `npm run dev` - start all workspaces that expose a development command.
- `npm run build` - build all buildable workspaces.
- `npm run lint` - lint all workspaces.
- `npm run typecheck` - type-check all workspaces.
- `npm run format` - format the repository.
- `npm run db:generate` - generate Prisma client.
- `npm run db:migrate` - create/apply Prisma migrations.

## Documentation

Start with [docs/architecture.md](docs/architecture.md) and [docs/setup.md](docs/setup.md).

Authentication foundation details are documented in [docs/auth-foundation.md](docs/auth-foundation.md).
