# System Integration Report

Module 06 Sequence 01 validates Tuljai Stays as one connected platform across backend, database, pilgrim app, owner app, admin dashboard, QR, notifications, settings, feature flags, analytics, monitoring, and reports.

## Architecture Review

The repository uses a monorepo structure with:

- `backend` for NestJS, Prisma, PostgreSQL, Socket.IO, notifications, storage, settings, reports, and QR workflows.
- `apps/pilgrim-app` for Expo React Native pilgrim booking and QR lifecycle.
- `apps/owner-app` for Expo React Native owner operations, booking handling, QR scan, register, rooms, and reports.
- `apps/admin-panel` for Next.js enterprise admin operations, governance, monitoring, platform control, and BI.
- `packages/shared`, `packages/types`, `packages/ui`, and `packages/utils` for cross-app contracts and helpers.

Shared types are used broadly for booking states, QR payloads, notifications, lodges, rooms, settings, reports, and auth contracts.

## Integration Gaps Found

1. HTTP API path consistency was mixed across apps. Some clients called `/api/...`, while others called `/auth`, `/admin`, `/lodges`, or `/owner`. The backend uses a global `/api` prefix.
2. Environment examples differed on whether the configured base URL should include `/api`.
3. Festival mode was stored as a feature flag but public app consumers checked for `festival_mode` in public settings.
4. Owner app receives emergency/festival notices through announcements, but it does not yet consume public feature flags/settings directly.
5. Advanced admin audit read, notes, escalation, transfers, exports, infrastructure metrics, and session revocation remain backend endpoint gaps.

## Resolved Issues

- The shared `ApiClient` now normalizes HTTP paths so both base URL styles are supported:
  - `https://api-host` with `/auth/request-otp`
  - `https://api-host/api` with `/api/auth/request-otp`
- The backend now exposes `GET /api/feature-flags/public`.
- Pilgrim public settings now load public feature flags and correctly read `festival_mode`.
- Admin live operations now reads public feature flags and settings consistently for festival mode.

## Cross-App Validation

### Booking State

Booking statuses are shared through `@tuljai/types` and used by backend, pilgrim app, owner app, and admin dashboard.

Validated lifecycle:

`PENDING_OWNER_APPROVAL` -> `ACCEPTED` or `REJECTED` -> `QR_GENERATED` -> `CHECKED_IN` -> `CHECKED_OUT` -> `COMPLETED`

Known limitation: admin notes, escalation, and transfer persistence require backend APIs.

### Room State

Room statuses are shared and used by owner room management and admin room governance. QR check-in sets room occupancy through backend workflow.

### Lodge Visibility

Lodge status and verification status are shared. Admin governs verification and status; pilgrim discovery consumes public lodge APIs.

## Authentication Validation

- Pilgrim, owner, and admin use OTP login through the same auth endpoints.
- Apps use the shared API client and secure/local token storage appropriate to platform.
- Admin route protection is centralized in the admin shell and protected-route layer.
- Logout clears sessions on the client and calls backend logout.

Known limitation: httpOnly cookie auth is not yet implemented.

## QR Validation

QR system supports:

- Server-generated QR token hashes.
- Pilgrim-safe signed display payload.
- Owner scan through `POST /api/qr/scan`.
- Expiry validation.
- Duplicate prevention.
- Wrong-lodge rejection.
- Booking/register unlock after successful scan.
- QR scan logging for monitoring.

Validated integration: pilgrim app renders `qrPayload`, owner app scans `qrPayload`, backend validates and logs result.

## Notification Validation

Notifications support:

- Booking accepted/rejected/QR/check-in/check-out events.
- Owner alerts.
- In-app notification lists and unread counters.
- Admin notification monitoring metrics.
- Emergency and festival announcements.
- Realtime announcement events.

Known limitation: provider queue depth and delivery retries require deeper provider instrumentation.

## Realtime Validation

Socket.IO is used for:

- Booking updates.
- Owner alerts/status.
- QR scan events.
- Room status updates.
- Announcements.
- Dashboard updates.
- Presence summaries.

Realtime clients strip `/api` from base URLs before connecting to `/realtime`, preserving compatibility after HTTP path normalization.

## Feature Flag And Settings Validation

- Admin manages settings and feature flags.
- Public settings are exposed through `GET /api/settings/public`.
- Public feature flags are now exposed through `GET /api/feature-flags/public`.
- Pilgrim app and admin live operations use public flags for festival mode.
- Emergency, maintenance, booking pause, QR, and app availability flags are consistent from the backend source.

Known limitation: owner app currently reacts mainly through announcements and realtime, not direct public flag reads.

## Permission Validation

Admin permissions are centralized. Backend route guards cover base roles (`ADMIN`, `OWNER`, `PILGRIM`, `SUPER_ADMIN`), while advanced admin operational roles are frontend-ready.

Known limitation: advanced admin role persistence and backend permission enforcement may need expansion before production staff rollout.

## Analytics Validation

Admin dashboard, monitoring, and BI read from:

- Dashboard summary.
- Booking reports.
- Commission reports.
- QR scan logs.
- Notification metrics.
- Presence metrics.

Analytics update as backend operational tables update. Predictive analytics, exports, settlement reports, customer dimensions, and geographic dimensions remain foundation-level.

## Error Recovery

Current behavior:

- API failures show friendly page-level messages.
- Admin protected routes redirect unauthenticated sessions.
- QR scan failures show owner-facing guidance.
- Realtime disconnect falls back to polling in admin live operations.
- Mobile QR scanner prevents duplicate payload processing.

Known limitation: offline caching remains conservative and does not support unsafe writes while offline.

## Production Readiness Score

| Area             | Score     | Reason                                                                                                                                      |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend          | Good      | Core APIs, QR, reports, settings, notifications, and audit writes exist; instrumentation gaps remain.                                       |
| Pilgrim App      | Good      | Booking, discovery, QR, announcements, notifications, and public festival flag integration are present.                                     |
| Owner App        | Good      | Booking actions, QR scan, register, rooms, reports, alerts, and announcements are present. Direct public flags remain a future enhancement. |
| Admin Dashboard  | Excellent | Operations, governance, platform control, monitoring, BI, and release docs are complete for internal QA.                                    |
| Realtime         | Good      | Socket.IO presence/events integrated; reconnect metrics and duplicate-event observability can improve.                                      |
| QR               | Excellent | Secure signed payload, validation, duplicate prevention, wrong-lodge rejection, register unlock, and monitoring exist.                      |
| Notifications    | Good      | Core notifications, announcements, realtime, metrics exist; provider queue depth missing.                                                   |
| Security         | Good      | JWT, OTP, RBAC foundations, permission gates, audit writes; httpOnly cookie auth and advanced permission persistence pending.               |
| Monitoring       | Good      | Health, presence, QR, notification, and dashboard monitoring exist; CPU/memory/backups require backend instrumentation.                     |
| Analytics        | Good      | Summary/report-based BI exists; predictive/customer/geographic dimensions need future models.                                               |
| Documentation    | Excellent | Admin and integration docs cover QA, operations, incidents, limitations, and readiness.                                                     |
| Overall Platform | Good      | Ready for integrated QA and production preparation, with clear backend instrumentation/export/audit gaps.                                   |

## Recommendations

- Add admin audit read API.
- Add admin notes, escalation, and transfer APIs.
- Add export job worker and scheduled report infrastructure.
- Add full session inventory/revocation APIs.
- Add backend infrastructure metrics and backup job status.
- Add direct owner app public settings/feature flag consumption.
- Add app-side enforcement for booking/QR/maintenance flags where currently only surfaced.
