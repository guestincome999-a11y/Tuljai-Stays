# Architecture

Tuljai Stays is organized as a monorepo with clear application and package boundaries.

## Layers

- Presentation: Expo apps and the Next.js admin panel.
- Application: backend modules that coordinate use cases, validation, authentication, and providers.
- Domain: future business entities and policies. These should stay independent of frameworks where possible.
- Infrastructure: Prisma, Supabase Storage, Firebase Cloud Messaging, Socket.IO, and external integrations.

## Applications

- `apps/pilgrim-app` uses Expo Router and React Native Paper for a Material Design 3 mobile experience.
- `apps/owner-app` uses the same mobile foundation with owner-specific modules added later.
- `apps/admin-panel` uses Next.js app router for administrative operations.
- `backend` uses NestJS modules, dependency injection, Prisma, and provider modules for integrations.

## Shared Packages

- `@tuljai/types` contains cross-platform TypeScript contracts.
- `@tuljai/utils` contains framework-neutral helpers, logging contracts, and reusable error types.
- `@tuljai/shared` contains Axios API client, environment, and session foundations.
- `@tuljai/ui` contains theme tokens and reusable UI primitives.

## API and Error Boundary

Client applications use the shared Axios API client from `@tuljai/shared`. Backend responses are normalized through a global exception filter so future feature modules return consistent `ApiErrorResponse` payloads.

## Realtime Boundary

Socket.IO is configured only as a foundation. Future realtime usage should stay limited to booking updates, owner alerts, QR check-in/check-out, room availability changes, and admin announcements.

## Storage and Notifications

Firebase Cloud Messaging and Supabase Storage are configured as injectable providers. They are intentionally passive until feature modules introduce concrete use cases.
