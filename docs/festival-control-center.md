# Festival Operations & Emergency Control Center

Implemented against `origin/main` (`fa4571bf`) in an isolated worktree. The original owner-app checkout and all its uncommitted work were preserved.

## Responsibilities and navigation

The sidebar groups are Dashboard, Lodges & Owners, Bookings, Users, Finance, Settings, Content, Festival Control, in that order. Existing pages remain accessible. Festival Control follows Content immediately.

Festival Control now owns operational mode, lodge intake, availability, recovery and diagnostics. Its previous banner editor and advisory settings are preserved under **Content → Banners & Advisories** (`/admin/banners`). Existing announcements, App Content and Promo Codes (`/admin/promotions`) remain intact. The duplicate festival feature-flag control and decorative readiness cards were removed. The former audit placeholder now reads real paginated audit records.

## Existing architecture reused

- `feature_flags.festival_mode` remains the sole authoritative mode flag. No parallel festival model exists. Existing `festival_start_date` and `festival_end_date` settings are reused; `festival_name` uses the existing settings table.
- Lodge `is_active`, verification/status, room status, dated availability, booking locks and active booking states remain authoritative.
- The existing `BookingAvailabilityService` is shared through a module so discovery and operations use checkout conflict rules. It counts room assignments, unassigned reservations, live holds, inactive room types and date blocks in grouped queries.
- Existing audit, owner notification inbox, Socket.IO, payment-intent reconciliation, finance/refund pages, and QR token/guest-register services are reused.
- No production credentials or environment files were changed. No production database operation was executed during implementation.

## Operational controls

The dashboard shows mode/name/dates, operational condition, activation/change identity, configuration revision and the last successful data read. Configuration is secondary; critical actions require a confirmation and meaningful audit reason. Mode changes use one transaction and a version check; concurrent stale forms fail visibly.

Lodges can be closed, marked fully booked and reopened. Closure writes `is_active=false` with an operational explanation; it does not change verification, rooms, bookings, collections or refunds. Owners receive a durable inbox notification in the same transaction, followed by existing push/socket delivery without delaying the closure response. Reopening requires a verified lodge and positive real availability for the selected stay. Fully-booked filtering includes manual fully-booked closures; zero-stock filtering separately uses actual availability.

Lodge row locking serializes closure against existing checkout inventory writers. Checkout takes a shared lodge lock before its existing room-type lock, allowing independent room types to proceed concurrently. New holds validate current lodge eligibility, including idempotent hold replays. Existing booking/payment idempotency remains in force. A payment already in progress can require the existing paid-allocation recovery path after closure; it is never blindly charged again or declared successful by the browser.

Festival mode filters public discovery to verified, active lodges with availability for the requested dates (today to tomorrow by default). Normal mode preserves normal discovery; explicit stay-date searches remain availability-aware. Configured festival prices apply only with the mode enabled and within its configured date window. Explicit date price overrides retain priority. Disabling mode retains configuration and intentional lodge closures; it does not automatically reopen a closed property.

## Pilgrim and owner synchronization

Both public discovery APIs recheck eligibility in the database, so a presentation cache on another API instance cannot keep a disabled lodge visible. Metadata caching, existing sort/budget/distance/property/amenity filters and pagination remain supported. Booking availability is validated again under inventory locks.

The paginated pilgrim catalogue now participates in existing refresh infrastructure, drops closed lodges immediately on an event, bounds remembered filter results, deduplicates matching requests and protects against stale responses. Reconnect/foreground and slow reconciliation recover missed events. Unauthenticated browsing also has a 60-second foreground reconciliation path. The older pilgrim UI deduplicates catalogue loads and debounces availability events. The feature flag takes precedence over a legacy boolean setting, allowing a mode to be disabled reliably.

The owner app keeps disabled lodges manageable, reloads assignments on lodge events and reconnect/foreground, and falls back to 45-second reconciliation while disconnected. Room management displays the closure reason. Existing confirmed booking passes and check-in remain usable for a temporarily closed, still-verified property; suspension/deletion checks remain.

Socket.IO remains best-effort across processes because the repository has no shared socket adapter. Fresh backend reads and client reconciliation provide fallback synchronization. The dashboard distinguishes a successful state read, a successful event publication and actual client connectivity; it never claims delivery acknowledgement from every device.

## Emergency workflows

1. **QR Check-in Not Working:** scanner/network checks, actual database/QR failure information, affected records, owner-app retry and an authorized manual route. Manual verification checks booking code and guest phone on the server, then uses the existing signed QR token, authorization, atomic token consumption and register creation. It cannot create duplicate check-ins or bypass an ineligible booking/token.
2. **Resolve Fully Booked Lodge:** dated room availability, allocation-conflict navigation, safe lodge closure, and verified reopening.
3. **Resolve Booking Processing Issue:** existing finance/recovery records, gateway reconciliation and booking status. Pending verification retries use a database lease and audit reason; they only query existing gateway orders. Confirmed and paid-allocation-review states are not blindly retried.
4. **Diagnose Lodge Loading Issue:** observed backend/database/realtime state, measured endpoint failures, eligibility/filter checks and safe refresh.

Quick actions link to real booking, intervention, conflict, room, notification, finance, refund, system-health and audit pages. There is no fabricated webhook failure queue, synchronization-job retry or infrastructure-log viewer. Recent actual webhook HTTP errors and publisher failures are shown when observed; recovery guidance explains the supported fallback.

## Metrics and performance

Operational KPIs come from the database. Lodge inventory is scoped to the selected stay; active-booking/payment/stay counts are platform-wide. Alerts use actual pending/recovery intent conditions, unsuccessful QR scans, failed deliveries, disabled verified lodges, HTTP server errors and event-publication failures. Alert timestamps describe observation time; related records provide occurrence history.

HTTP telemetry is bounded, process-local and covers controller requests after authorization over five calendar minutes (transport and guard failures are outside this sample): completed requests, 4xx/5xx errors, average latency, active/failed booking or check-in requests, endpoint summaries, sanitized recent errors and measured RSS memory. Database probe latency, authenticated realtime users, publisher initialization, recent failed emissions and last successful publication are measured. Fleet-wide traffic, infrastructure logs and gateway uptime are explicitly unavailable.

Catalogue metadata rebuilds, simultaneous inventory reads and admin refreshes are deduplicated. Availability uses grouped queries rather than per-lodge requests. Completed inventory reads are not cached. Lodge tables paginate at 20 rows and audit history at 30. Existing booking locks and payment leases provide server-side concurrency control.

Local synthetic load exercise: **1,000 catalogue requests, concurrency 50, zero HTTP errors, 1,959 ms total, 88 ms p50, 179 ms p95**. This measures the local fixture, not production capacity. The real PostgreSQL concurrency test permits exactly one successful hold from 30 simultaneous requests for the last room.

## Migration and rollout

`backend/prisma/migrations/20261112000000_festival_lodge_operations/migration.sql` adds nullable `lodges.operations_reason` plus booking-lock availability and payment-intent status/time indexes. Existing migration files are unchanged. There are no destructive data operations or replacement models.

Deploy in this order:

1. Review the additive migration and apply it through the existing backend deployment procedure. The current backend start command already runs `prisma migrate deploy`.
2. Deploy the backend, then Admin Panel, then distribute the updated pilgrim and owner apps through their existing release/update process.
3. Set festival name/dates and review room pricing. Enable the mode explicitly after verifying real inventory.
4. Confirm real gateway/webhook, push credentials and operational access in the target environment. These production integrations were not exercised with live charges or real-device pushes.
5. Validate deployed capacity, database connection limits and cross-instance realtime infrastructure under the expected festival traffic. Local tests do not certify production-scale capacity.

## Verification

Validation includes workspace TypeScript/ESLint, Prisma generation/validation, backend and Admin Panel production builds, Android production exports for both mobile apps, existing application suites, new festival unit tests and PostgreSQL integration tests. Integration tests use isolated loopback `tuljai_test_*` databases. The existing integration fixture adapts two pre-existing historical migration assumptions; it does not modify those migration files.

Live local HTTP/WebSocket checks cover authorization, invalid date rejection, protected audit access, closure/reopening, pilgrim and owner events, owner access to the disabled lodge and authoritative catalogue visibility. Live manual check-in checks verify identity rejection, duplicate protection and preservation of an existing reservation/payment at a disabled lodge.

Headless Chromium checks against the real local API cover confirmation gating, mode transitions, lodge closure/reopening, guided QR recovery, filters, recoverable synchronization failure, Content/Promo Code preservation, sidebar order and a 390px mobile viewport without horizontal page overflow. No fake dashboard data was used for these browser checks.

Signed mobile binaries, physical-device camera tests, live Razorpay charges/refunds, real push delivery and production deployment verification remain release-environment checks. Validation results: 205 backend tests passed with PostgreSQL and zero skips; 8 pilgrim tests, 26 owner tests and 4 admin tests passed. Workspace TypeScript, ESLint, Prisma validation and all affected production builds/exports passed. Git commit/push results are recorded in the accompanying completion report.
