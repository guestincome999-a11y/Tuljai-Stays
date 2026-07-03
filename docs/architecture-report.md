# Tuljai Stays Architecture Report

Generated for the current foundation state of `D:\Tuljai-Stays`.

## Folder Tree

Source-focused tree. Generated folders such as `node_modules`, `.next`, `dist`, `coverage`, and `backend/generated` are intentionally excluded.

```text
root/
|-- apps/
|   |-- pilgrim-app/
|   |   |-- app/
|   |   |   |-- _layout.tsx
|   |   |   `-- index.tsx
|   |   |-- src/
|   |   |   |-- api/
|   |   |   |   `-- client.ts
|   |   |   `-- auth/
|   |   |       `-- auth-session-store.ts
|   |   |-- .env.example
|   |   |-- app.json
|   |   |-- babel.config.js
|   |   |-- expo-env.d.ts
|   |   |-- metro.config.js
|   |   |-- package.json
|   |   `-- tsconfig.json
|   |-- owner-app/
|   |   |-- app/
|   |   |   |-- _layout.tsx
|   |   |   `-- index.tsx
|   |   |-- src/
|   |   |   |-- api/
|   |   |   |   `-- client.ts
|   |   |   `-- auth/
|   |   |       `-- auth-session-store.ts
|   |   |-- .env.example
|   |   |-- app.json
|   |   |-- babel.config.js
|   |   |-- expo-env.d.ts
|   |   |-- metro.config.js
|   |   |-- package.json
|   |   `-- tsconfig.json
|   `-- admin-panel/
|       |-- app/
|       |   |-- globals.css
|       |   |-- layout.tsx
|       |   `-- page.tsx
|       |-- src/
|       |   |-- api/
|       |   |   `-- client.ts
|       |   `-- auth/
|       |       `-- auth-session-store.ts
|       |-- .env.local.example
|       |-- next-env.d.ts
|       |-- next.config.ts
|       |-- package.json
|       `-- tsconfig.json
|-- backend/
|   |-- prisma/
|   |   `-- schema.prisma
|   |-- src/
|   |   |-- modules/
|   |   |   |-- auth/
|   |   |   |   |-- decorators/
|   |   |   |   |-- guards/
|   |   |   |   |-- strategies/
|   |   |   |   `-- auth.module.ts
|   |   |   |-- health/
|   |   |   |-- notifications/
|   |   |   |-- prisma/
|   |   |   |-- realtime/
|   |   |   `-- storage/
|   |   |-- shared/
|   |   |   |-- config/
|   |   |   `-- filters/
|   |   `-- main.ts
|   |-- .env.example
|   |-- nest-cli.json
|   |-- package.json
|   |-- prisma.config.ts
|   `-- tsconfig.json
|-- packages/
|   |-- ui/
|   |   `-- src/
|   |       |-- components/
|   |       `-- theme/
|   |-- shared/
|   |   `-- src/
|   |       |-- api-client.ts
|   |       |-- app-config.ts
|   |       |-- auth-session.ts
|   |       |-- environment.ts
|   |       `-- index.ts
|   |-- types/
|   |   `-- src/
|   |       |-- api.ts
|   |       |-- auth.ts
|   |       |-- common.ts
|   |       `-- index.ts
|   `-- utils/
|       `-- src/
|           |-- assertions.ts
|           |-- date.ts
|           |-- errors.ts
|           |-- logger.ts
|           |-- pagination.ts
|           `-- index.ts
|-- docs/
|-- scripts/
|-- .editorconfig
|-- .env.example
|-- .gitignore
|-- .prettierrc.json
|-- eslint.config.mjs
|-- package.json
|-- package-lock.json
|-- README.md
`-- tsconfig.base.json
```

## Installed Dependencies

### Root Tooling

- TypeScript `^5.9.3`
- ESLint `^9.39.1`
- TypeScript ESLint `^8.49.0`
- Prettier `^3.6.2`
- eslint-config-prettier `^9.1.0`
- eslint-plugin-import `^2.31.0`

### Backend

- NestJS core packages `^11.1.27`
- NestJS Config `^4.0.4`
- NestJS JWT `^11.0.2`
- NestJS Passport `^11.0.5`
- NestJS Fastify platform `^11.1.27`
- NestJS Socket.IO/WebSockets `^11.1.27`
- Fastify Helmet `^13.0.2`
- Prisma Client and PostgreSQL adapter `^7.8.0`
- Prisma CLI `^7.8.0`
- PostgreSQL driver `pg ^8.22.0`
- Supabase JS `^2.110.0`
- Firebase Admin `^14.1.0`
- Socket.IO `^4.8.3`
- Passport JWT, class-validator, class-transformer, RxJS, reflect-metadata

### Mobile Apps

Both `@tuljai/pilgrim-app` and `@tuljai/owner-app` use:

- Expo `^57.0.2`
- Expo Router `^57.0.3`
- React `19.2.7`
- React Native `0.86.0`
- React Native Paper `^5.15.3`
- React Native Screens `4.25.2`
- React Native Safe Area Context `5.8.0`
- React Native Gesture Handler `3.0.2`
- React Native Reanimated `4.5.1`
- Expo Splash Screen and Status Bar
- Shared internal packages: `@tuljai/shared`, `@tuljai/types`, `@tuljai/ui`

### Admin Panel

- Next.js `^16.2.10`
- React `19.2.7`
- React DOM `19.2.7`
- Shared internal packages: `@tuljai/shared`, `@tuljai/types`

### Shared Packages

- `@tuljai/shared`: Axios `^1.13.2`, internal types and utils.
- `@tuljai/ui`: React Native Paper-compatible theme/UI code.
- `@tuljai/types`: shared TypeScript contracts.
- `@tuljai/utils`: framework-neutral utilities.

## Workspace Structure

The repository uses npm workspaces:

```json
["apps/*", "backend", "packages/*"]
```

Workspace packages:

- `@tuljai/pilgrim-app`
- `@tuljai/owner-app`
- `@tuljai/admin-panel`
- `@tuljai/backend`
- `@tuljai/ui`
- `@tuljai/shared`
- `@tuljai/types`
- `@tuljai/utils`

Root scripts:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run format`
- `npm run format:check`
- `npm run verify:workspace`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:studio`

## Backend Architecture

Backend framework: NestJS 11 with Fastify.

Entry point:

- `backend/src/main.ts`

Global backend foundations:

- Global API prefix: `/api`
- CORS enabled for future app/admin clients.
- Fastify Helmet registered for security headers.
- Global validation pipe with:
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
  - `transform: true`
- Global exception filter returns normalized API error payloads.
- Configuration loaded via `@nestjs/config`.
- Environment validation via `class-validator`.

Backend modules:

- `AppModule`: root composition module.
- `PrismaModule`: global Prisma client provider using Prisma 7 PostgreSQL adapter.
- `AuthModule`: JWT strategy, JWT guard, role guard, current-user decorator, role metadata decorator.
- `HealthModule`: health endpoint.
- `RealtimeModule`: Socket.IO gateway foundation.
- `NotificationsModule`: Firebase Cloud Messaging provider foundation.
- `StorageModule`: Supabase Storage provider foundation.

Clean architecture readiness:

- Presentation layer begins with controllers/gateways.
- Application/domain layers are intentionally not implemented yet because business features are not part of this phase.
- Infrastructure providers are injectable and isolated behind modules.
- Business logic is absent from UI and backend infrastructure files.

## Database Schema Summary

Database: PostgreSQL via Prisma ORM.

Prisma files:

- `backend/prisma/schema.prisma`
- `backend/prisma.config.ts`

Generated client output:

- `backend/generated/prisma`

Current enum:

- `UserRole`
  - `PILGRIM`
  - `OWNER`
  - `ADMIN`
  - `SUPER_ADMIN`

Current models:

### `User`

Mapped table: `users`

Fields:

- `id`: UUID primary key
- `phoneNumber`: unique phone number, mapped to `phone_number`
- `displayName`: nullable display name, mapped to `display_name`
- `roles`: array of `UserRole`, defaults to `PILGRIM`
- `isActive`: boolean, mapped to `is_active`
- `createdAt`: timestamp, mapped to `created_at`
- `updatedAt`: auto-updated timestamp, mapped to `updated_at`
- `deletedAt`: nullable soft-delete timestamp, mapped to `deleted_at`
- `auditLogs`: relation to `AuditLog`

Indexes:

- `phoneNumber`
- `deletedAt`

### `AuditLog`

Mapped table: `audit_logs`

Fields:

- `id`: UUID primary key
- `actorUserId`: nullable user reference, mapped to `actor_user_id`
- `action`: action name
- `entityType`: entity type, mapped to `entity_type`
- `entityId`: nullable UUID, mapped to `entity_id`
- `metadata`: nullable JSON
- `createdAt`: timestamp, mapped to `created_at`
- `updatedAt`: auto-updated timestamp, mapped to `updated_at`

Indexes:

- `actorUserId`
- `entityType`, `entityId`
- `createdAt`

Relationship:

- `AuditLog.actor` references `User.id` with `onDelete: SetNull`.

## Mobile Architecture

Mobile apps:

- `apps/pilgrim-app`
- `apps/owner-app`

Shared architecture:

- Expo Router entry via `expo-router/entry`.
- Root navigation shell in `app/_layout.tsx`.
- Material Design 3 theme provided through React Native Paper.
- Automatic light/dark theme selection via `useColorScheme`.
- Shared API client in `src/api/client.ts`.
- Shared auth session store foundation in `src/auth/auth-session-store.ts`.
- Initial screen is a foundation placeholder using shared UI primitives.

Mobile shared packages:

- `@tuljai/ui`: `AppScreen`, `EmptyState`, MD3 themes and tokens.
- `@tuljai/shared`: environment reader, Axios client, auth session contract.
- `@tuljai/types`: auth/API/common contracts.

Prepared for future:

- Authentication screens.
- Lazy-loaded app modules.
- Offline storage layer.
- Push token registration.
- Owner alerts and realtime booking updates.
- Image upload/compression workflows.

## Admin Architecture

Admin app:

- `apps/admin-panel`

Framework:

- Next.js 16 app router.

Current structure:

- `app/layout.tsx`: root document layout and metadata.
- `app/page.tsx`: foundation landing screen.
- `app/globals.css`: CSS variables for light/dark theme colors.
- `src/api/client.ts`: shared Axios API client instance.
- `src/auth/auth-session-store.ts`: admin auth session foundation.

Admin is prepared for:

- Auth-protected route groups.
- RBAC-aware dashboards.
- Operational modules.
- Server/client API boundaries.

No admin business features are implemented yet.

## APIs Implemented

Only foundation API is implemented:

| Method | Path          | Module         | Purpose              |
| ------ | ------------- | -------------- | -------------------- |
| `GET`  | `/api/health` | `HealthModule` | Backend health check |

Socket.IO foundation:

| Namespace   | Event                | Direction        | Purpose                                        |
| ----------- | -------------------- | ---------------- | ---------------------------------------------- |
| `/realtime` | `connection:ready`   | server to client | Confirms websocket connection                  |
| `/realtime` | `admin:announcement` | server broadcast | Foundation method exists, no business workflow |

## Features Completed

- npm workspace monorepo.
- Root TypeScript configuration.
- ESLint flat config.
- Prettier configuration.
- Git ignore configuration.
- Environment variable examples.
- Expo pilgrim app shell.
- Expo owner app shell.
- Next.js admin panel shell.
- NestJS backend shell.
- Fastify backend adapter.
- Global backend validation.
- Centralized backend error response filter.
- JWT strategy foundation.
- JWT auth guard foundation.
- RBAC guard and role decorator foundation.
- Current user decorator foundation.
- Prisma 7 PostgreSQL configuration.
- Database models for users and audit logs.
- Socket.IO gateway foundation.
- Firebase Cloud Messaging provider foundation.
- Supabase Storage provider foundation.
- Shared Axios API client.
- Shared auth session contracts.
- Shared API response contracts.
- Shared logging utilities.
- Shared application error type.
- Shared pagination utilities.
- Shared Material Design 3 theme tokens.
- Shared React Native UI primitives.
- Setup and architecture documentation.

## Remaining TODOs

No code TODO comments are present as placeholders. Remaining work is future feature work:

- OTP request and verification module.
- JWT token issuing and refresh flow.
- Persistent auth session storage.
- User profile bootstrap.
- City/location model for future multi-city expansion.
- Lodge/property module.
- Room and availability module.
- Booking module.
- Owner approval workflow.
- QR generation and scan verification workflow.
- Notification workflow implementation.
- FCM token registration.
- Supabase upload workflows and file validation.
- Admin RBAC route protection.
- Audit log write use cases.
- Pagination/query DTO standards per feature.
- Automated test suite.
- Render deployment manifests.
- GitHub Actions CI.

## Current Build Status

Last verified from `D:\Tuljai-Stays`:

```text
npm run db:generate    PASS
npm run typecheck      PASS
npm run lint           PASS
npm run build          PASS
npm run format:check   PASS
```

Build output summary:

- Next.js admin panel builds successfully.
- NestJS backend builds successfully.
- Mobile app type checks pass.
- Shared packages type check and lint successfully.

## Known Issues

- `npm install` reports 21 moderate upstream dependency advisories from framework transitive dependencies. No high-severity advisory remains in the current audit threshold run. These should be monitored and updated when upstream packages publish compatible fixes.
- No automated unit or integration tests exist yet.
- Prisma migration has not been created or applied because a live PostgreSQL database is not configured in this foundation phase.
- The mobile apps have not been launched in Expo during this report generation.
- The admin build can rewrite `apps/admin-panel/next-env.d.ts`; formatting normalizes it afterward.
- Production deployment configuration for Render is not implemented yet.

## Git Status

Current branch:

```text
module-01-foundation
```

Latest foundation commit:

```text
0bb09a6 Initialize project foundation
```

Current working tree at report creation:

```text
Modified/added: docs/architecture-report.md
```

This report itself is the only intentional new project artifact from this task.
