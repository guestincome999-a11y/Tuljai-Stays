# Cancellation and refund implementation report

## Architecture assessment

Investigated current `origin/main` (`7cd869c6`) and recent authentication, payment recovery, checkout idempotency, room availability, cash collection and admin booking activity commits. Implementation lives in the existing monorepo. The original `D:/Tuljai-Stays` working tree contained extensive unrelated edits; they were preserved. Work was isolated in `D:/Tuljai-Stays-refunds`, branch `codex/automated-cancellation-refunds`.

Existing mechanisms reused:

- `BookingsService`, inventory room-type locks and booking row locks.
- Existing `payment_collections` table: `ONLINE`/`RAZORPAY` collections versus `PAY_AT_LODGE` cash collections. Booking payment status alone is not proof of capture.
- `RazorpayProvider`, server-only credentials and raw-body HMAC webhook verification.
- Payment recovery scheduler, now also draining database-backed refund and notification work.
- Existing persisted notifications, Expo/FCM push, unread counts, user sockets and delivery logs.
- Existing commission eligibility ledger and settlement allocations: online commission becomes eligible on captured/verified payment; cash commission becomes eligible at check-in.

Root gaps were cancellation without durable refund work, an unrestricted status-update path bypassing cancellation side effects, an untracked low-level refund helper, a dashboard-only refund list, transient notification deduplication and revenue projections including cancelled paid bookings. Recipient-specific realtime notifications also reached role channels; that ownership leak is closed.

## Policy

India calendar days before **check-in**, not hours before payment:

| Cancellation day               | Cancellation fee | Refund entitlement |
| ------------------------------ | ---------------- | ------------------ |
| Check-in day or day before     | 20%              | 80%                |
| 2–3 days before check-in       | 10%              | 90%                |
| 4 or more days before check-in | None             | 100%               |
| Admin operational cancellation | None             | 100%               |

Refunds are calculated from online captured amounts, less earlier provider refunds. Fractional refund paise are rounded down. `Room Full`, `Room Unavailable`, `Lodge Unable to Accommodate` and `Operational Issue` cannot carry deductions.

An admin may instead select `Pilgrim Support Request`, link a ticket belonging to the pilgrim and booking, and enter an explicit deduction in rupees with a reason. The server validates the amount, ownership and available online collection; the ticket link, deduction and actor are audited. This is not a manual refund endpoint.

The existing admin Settings page exposes `booking_cancellation_policy` as validated JSON. New bookings snapshot it through an insert trigger. Existing bookings without a snapshot use the configured policy at cancellation; historical booking/payment totals and completed settlements are not rewritten. Terms and Conditions now describe these fees and the original-payment-method timeline.

## Transaction and duplicate protection

Cancellation takes the existing inventory lock, then locks/re-reads the booking and its collections. The transaction records terminal cancellation, actor, timestamp, policy/deduction, booking history, room release/history, QR revocation, audit log, refund entitlement and notification outbox together. Repeated cancellation returns the committed booking. Concurrent admin/pilgrim cancellation uses the first committed decision; a later request does not overwrite that audited policy.

Each collection has one logical refund reference and a unique ledger row. Provider attempts have unique receipts and refund IDs. Short database reservations and expiring leases protect workers across backend instances. External calls run outside cancellation transactions; refund retry provider reads also run outside database transactions.

Every POST is preceded by capture/ownership/currency/amount validation and a paginated provider refund scan. Unknown timeouts retain the same receipt and attempt. A new receipt is permitted only after a prior provider refund is verified as failed. Existing refunds reduce entitlement and remaining capture; their IDs, amounts and statuses are audited. Refunds cannot exceed capture, and captured-amount constraints also apply in the database.

Authorized payments are not captured just to refund them. They remain under reconciliation; failed uncaptured payments become `NOT_REQUIRED`. A later signed captured-payment event can resume an unsubmitted cancellation refund, including a different captured payment attempt for the same order. It cannot reactivate the booking.

The 30-second recovery cycle survives Render restarts because all work is in PostgreSQL. Temporary provider errors retain pending work. Definitive validation/provider errors surface as failed refunds for attention. A worker lease expires after a crash. Manual reconciliation cannot authorize another POST for a failed refund; the separate audited retry action is required.

## Database changes

Additive migration: `backend/prisma/migrations/20261110000000_cancellation_refund_ledger/migration.sql`.

- Booking: cancellation timestamp, administrator/user ID and policy snapshot.
- Existing collections mapped into Prisma without recreating the table.
- `booking_refunds`: unique reference/collection, amount and original entitlement in integer paise, captured amount, percentage, payment reference/method, lifecycle, errors, timestamps and worker lease.
- `refund_attempts`: immutable attempt receipt, provider refund ID, amount, speed and lifecycle history.
- `refund_webhook_events`: deduplicated event references, processing logs and reconciliation schedule. Full payment/card payloads are not retained.
- `refund_notification_outbox`: durable notification work with unique keys and retry scheduling.
- Notifications: optional unique deduplication key.
- Support tickets: optional booking link.
- Insert-time policy snapshot and terminal-cancellation protection triggers.
- Foreign keys, lookup/worker indexes, amount checks, and RLS on all four new financial/work tables. Client access is through authenticated Nest endpoints.

No reset, destructive table change, historical refund backfill or production database write was performed during local verification. Existing historical migrations are unchanged. The local integration fixture retains the repository's two historical replay accommodations: an already-created review table and an old data migration requiring a seed setting.

## APIs

| Method | Path                                       | Purpose                                                                                   |
| ------ | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| GET    | `/api/bookings/:id/cancellation-preview`   | Owned-booking policy and indicative entitlement                                           |
| POST   | `/api/bookings/:id/cancel`                 | Existing cancellation route, extended with durable refund handling                        |
| POST   | `/api/admin/bookings/:id/cancel`           | Confirmed operational or support-request cancellation                                     |
| PATCH  | `/api/admin/bookings/:id/status`           | Cancellation is routed through the same service; cancelled bookings cannot be reactivated |
| GET    | `/api/admin/finance/refunds`               | Search, status filter, pagination and totals                                              |
| GET    | `/api/admin/finance/refunds/:id`           | Attempts, provider errors, webhook and audit history                                      |
| POST   | `/api/admin/finance/refunds/:id/reconcile` | Audited provider reconciliation                                                           |
| POST   | `/api/admin/finance/refunds/:id/retry`     | Validated, audited failed-refund retry                                                    |
| POST   | `/api/payments/razorpay/webhook`           | Existing signed payment/refund webhook                                                    |

Refund administration requires the existing ADMIN/SUPER_ADMIN authorization. Owners cannot initiate refunds. Pilgrims can only cancel their own eligible pre-stay bookings. New clients send `confirmed: true`; older released pilgrim clients retain their existing confirmation dialog during rollout. Explicit false confirmation is rejected. Admin cancellation always requires true confirmation.

## Razorpay integration and webhook setup

Official [normal refund API](https://razorpay.com/docs/api/refunds/create-normal/) uses `POST /v1/payments/:payment_id/refund`, integer smallest-currency amounts, `speed: normal`, `receipt` and notes. The documented receipt is the provider idempotency key. Notes contain booking reference, cancellation reason and internal reference. Paginated payment refund reads and refund-ID reads reconcile timeouts and missed events. API success means `INITIATED`; only a later authenticated provider status read, including webhook-triggered reconciliation, confirms `PROCESSED`.

Configure the existing Razorpay webhook URL as:

```text
https://<backend-host>/api/payments/razorpay/webhook
```

Enable existing payment events plus:

```text
refund.created
refund.processed
refund.failed
refund.speed_changed
```

Set the matching `RAZORPAY_WEBHOOK_SECRET` on Render. Continue using existing `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the backend. No secret belongs in Expo public variables or Next.js client code. Configure and verify test-mode and live-mode webhooks separately. Raw-body verification runs before parsing or recording events. Event IDs deduplicate delivery; processing uses current provider reads so stale events cannot regress processed refunds. Unmatched events are retained with backoff for investigation.

## Notifications and interfaces

The outbox hands off to the existing notification service. Unique database keys persist one logical cancellation/refund notice per recipient/state; unread counts and realtime updates target the owning user. Failed refunds also notify active administrators individually. Failed push attempts use the existing delivery log/retry mechanism, with bounded attempt counts and sent-device suppression. External push delivery is inherently at least once across a crash after provider acceptance; stable notification IDs support deduplication. In-app records remain durable.

Pilgrim My Bookings and Booking Details show cancelled status, refund state and amount, provider reference, original payment method, cancellation reason and the specified messages. Confirmation fetches the server policy preview and records an entered reason. Refund notifications refresh private booking data across devices and on reconnect. No initiated message claims that bank credit has already occurred.

Finance → Payments → Refunds now has totals, status counts, searchable/filterable records, details/history, provider failures, reconcile/retry and CSV export of all filtered pages. CSV cells are escaped against spreadsheet formula injection. Booking details have a separate cancellation panel with operational reasons and the restricted support deduction flow. No unrestricted manual refund button was added.

Cancelled paid bookings are excluded from successful revenue projections. Owner revenue and outstanding settlements reuse the existing `tuljai_commission_is_eligible` financial policy and exclude cancelled/refunded bookings. Settlement and cancellation use the same booking-before-ledger lock order. The existing commission trigger voids unallocated cancelled-booking ledger entries. Existing settlement transactions remain historical records; no allocation or commission snapshot is rewritten. Allocated commission on a newly cancelled booking is explicitly flagged in its audit/details and generates a durable administrator accounting-review notification. Cancellation fees are not silently recognized as completed-stay commission revenue.

## Main implementation files

- Backend booking service/controller/DTO and shared booking types.
- Existing payment service/provider/module/recovery scheduler; new `refund-policy.ts`, `refunds.service.ts`, `refunds.controller.ts`.
- Existing notification service/events/policy/delivery, settings and finance/operations reports.
- Prisma schema and additive migration named above.
- Admin `RefundsView`, `AdminCancellationPanel`, refund API client, booking/refund/settings pages and settings definitions.
- Pilgrim booking API, booking mapping/provider, booking list/detail screens and legal documents.
- `backend/scripts/refunds.test.mjs`, existing payment test fixture, backend test command and booking reliability workflow.

## Verification and deployment

Tests use only loopback PostgreSQL and mocked Razorpay responses. No real refund API call is made in automated tests.

| Check                                                        | Local result                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Clean `npm ci` and repository patches                        | Passed                                                            |
| All workspace typechecks, including both Expo apps and Admin | Passed                                                            |
| All workspace lint checks                                    | Passed                                                            |
| Backend regression suite                                     | Passed; its optional cash DB case was subsequently run explicitly |
| Final refund suite                                           | 30 passed, none skipped                                           |
| Explicit cash-collection suite with PostgreSQL fixture       | 14 passed, none skipped                                           |
| Admin regression tests                                       | 2 passed                                                          |
| Prisma schema validation                                     | Passed                                                            |
| Existing-schema upgrade through `prisma migrate deploy`      | New migration applied successfully; all 32 migrations up to date  |
| Monorepo production build (backend, Admin, shared packages)  | Passed                                                            |
| Pilgrim and Owner Android production bundle exports          | Passed                                                            |
| RLS with an ordinary test role granted table SELECT          | All four new tables returned no rows                              |
| Diff, migration safety and environment/secret review         | Reviewed; no environment file or credential changes               |

The refund suite includes the 20 requested cases plus raw-body authenticity, IST day boundaries, late captured attempts, authorization reversal, policy snapshots, DB rollback, existing-refund exhaustion, preserved commission eligibility, historical settlement review and RLS isolation. Live push-device delivery, Razorpay test-mode end-to-end execution, webhook dashboard configuration and production deployment remain separate activation checks below.

Before calling production refunds operational:

1. Review and deploy the additive migration with the existing `prisma migrate deploy` release path; confirm it is recorded successfully before serving the new backend.
2. Deploy the backend and admin build, then publish/build the updated pilgrim client through the existing Expo release process. Older pilgrim confirmation remains compatible; new refund details require the updated client.
3. Confirm the displayed policy and Terms and Conditions, including support deductions. Validate existing production settings rather than overwriting them blindly.
4. Configure matching Razorpay test credentials and webhook events/secret in the test environment. Run controlled full/partial/admin/uncaptured/timeout cases and compare provider IDs and integer-paise amounts against the ledger. Exercise retry with a confirmed failed test refund and replay webhook deliveries.
5. Confirm push on real registered devices and cross-device unread counts. Verify Render restarts resume pending work and pending/unmatched/failed records remain visible.
6. Configure live credentials/webhooks separately and verify deployment health. Native signing/store distribution, bank-credit timing and live refunds were not verified by local mocks or bundle exports.

Existing historical cancellations are intentionally not automatically refunded. Review any historical discrepancies and previously settled/refunded bookings separately with explicit audited accounting adjustments.

## Changed file manifest

The refund records follow-up adds the shared Finance search/filter styling, separate payment and refund badges, readable activity/details, and `RefundRecords.tsx`/`RefundStyles.tsx`. Admin Payments and Razorpay lists use a consistent status projection for table rows, filters and totals: failed attempts and cancelled unpaid bookings no longer remain Pending, while captured and refunded receipts retain their actual status. Provider reconciliation records verified failures and recognizes authorized retries without demoting captured payments. `payment-collection-status.ts` shares that logic; PostgreSQL regression cases cover the labels, filtering/counts, retries and capture protection. This follow-up requires no new migration.

```text
.github/workflows/booking-reliability.yml
apps/admin-panel/app/admin/bookings/[id]/page.tsx
apps/admin-panel/app/admin/payments/refunds/page.tsx
apps/admin-panel/app/admin/settings/page.tsx
apps/admin-panel/src/api/refunds-api.ts
apps/admin-panel/src/components/bookings/AdminCancellationPanel.tsx
apps/admin-panel/src/components/finance/RefundsView.tsx
apps/admin-panel/src/platform-control/platform-control-config.ts
apps/pilgrim-app/src/features/bookings/api/bookings-api.ts
apps/pilgrim-app/src/pilgrim-ui/PilgrimAppProvider.tsx
apps/pilgrim-app/src/pilgrim-ui/backend-sync.ts
apps/pilgrim-app/src/pilgrim-ui/legal-documents.tsx
apps/pilgrim-app/src/pilgrim-ui/mock-data.ts
apps/pilgrim-app/src/pilgrim-ui/screens/PilgrimBookingDetailScreen.tsx
apps/pilgrim-app/src/pilgrim-ui/screens/PilgrimBookingsScreen.tsx
backend/package.json
backend/prisma/migrations/20261110000000_cancellation_refund_ledger/migration.sql
backend/prisma/schema.prisma
backend/scripts/payment-regression.test.mjs
backend/scripts/refunds.test.mjs
backend/src/modules/bookings/bookings.controller.ts
backend/src/modules/bookings/bookings.service.ts
backend/src/modules/bookings/dto/booking.dto.ts
backend/src/modules/lodges/commission-finance.service.ts
backend/src/modules/notifications/notification-delivery.service.ts
backend/src/modules/notifications/notification-events.service.ts
backend/src/modules/notifications/notification-policy.ts
backend/src/modules/notifications/notifications.service.ts
backend/src/modules/operations/operations.service.ts
backend/src/modules/payments/payment-recovery-scheduler.service.ts
backend/src/modules/payments/payments.module.ts
backend/src/modules/payments/payments.service.ts
backend/src/modules/payments/providers/razorpay.provider.ts
backend/src/modules/payments/refund-policy.ts
backend/src/modules/payments/refunds.controller.ts
backend/src/modules/payments/refunds.service.ts
backend/src/modules/settings/settings.service.ts
docs/automated-cancellation-refunds.md
docs/razorpay-webhook-setup.md
packages/types/src/booking.ts
```
