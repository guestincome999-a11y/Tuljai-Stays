# Booking activity and lodge payment collection

## Collection step before check-in

For pay-at-lodge bookings, the admin flow places collection immediately before the check-in step. Until confirmed it says **Payment collection pending**, with no fabricated timestamp. A confirmed receipt replaces that placeholder with **Payment Collected by <collector name>**, the amount and the actual collection confirmation timestamp in IST. This is a workflow display position; if collection happened after check-in, both real timestamps remain unchanged. Online receipt ordering is unchanged.

The authenticated collector's lodge membership name (or account name when no lodge membership exists) is snapshotted in the existing audit metadata with the confirmation request's server time. That same time is written to the receipt. Duplicate requests return the original result without changing its name or time. Legacy receipts use the linked actor's same-lodge membership name when no saved name exists. No client-provided name or time is trusted, and no new migration or APK is needed.

Validation for this update: 23 focused cash/activity/admin-refresh tests passed, 1 optional database case skipped in that run; the separate real PostgreSQL cash suite passed all 14 tests. This covers workflow position, no pending timestamp, confirmation replacement, original timestamps on retries, same-lodge name fallback and stable audit snapshots. Backend and admin production builds, TypeScript checks, scoped lint and whitespace checks passed.

Release scope: the protected owner cash-collection endpoint, its receipt uniqueness migration, and the existing admin booking detail timeline. No owner or pilgrim layout changes are included in this release.

`POST /api/owner/bookings/:id/collect-payment` accepts the confirmed `expectedAmount`. Only an authorized lodge owner/staff/admin may collect an eligible checked-in pay-at-lodge booking. A booking row lock, stable receipt reference and partial unique index serialize simultaneous devices and retries. Receipt, balance and audit changes commit together. The booking retains its PAY_AT_LODGE method; it is never represented as an online payment. Existing adjustments require review.

The admin booking detail response adds optional `activity` events from booking history, QR-token issuance, explicit check-in/checkout timestamps, confirmed payment collections and collection audit actors. It does not infer historical event times from `updatedAt` or treat a booking's payment-status label as a receipt. Legacy records without stored events cannot supply unknown historical timestamps.

The same booking detail page shows Booked, acceptance/rejection, QR generation/reissues, check-in, checkout, cancellation/expiry/completion and payment receipts when recorded. Payments show their amount, online/lodge method, recorded actor when available, and timestamp in Asia/Kolkata (IST). Realtime events refresh the page, with focus and 45-second visible-page fallback refreshes. Older requests cannot overwrite a newer refresh.

Apply migration `20261102120000_owner_cash_collection` through the existing Render migration command before the backend accepts collection requests. The existing APK can then use its collection button; no app rebuild is required for the endpoint rollout.

Validation: cash collection and activity tests, real disposable PostgreSQL concurrency/authorization/receipt-to-timeline checks, admin detail realtime and stale-response tests, TypeScript checks, scoped lint, backend and admin production builds. See the release report for actual execution results. Do not submit production financial events as deployment smoke tests; verify the route's authentication guard instead.

Executed before publication on 3 November 2026:

- Backend regression suite: 48 passed, 2 optional database cases skipped. This includes five lifecycle/payment timeline tests.
- Cash collection suite against the disposable local PostgreSQL database: all 13 passed, including six competing transactions, unauthorized owner rejection, and one receipt appearing once in the admin timeline.
- Admin booking detail refresh tests: 2 passed, covering collection notifications, focus/poll refresh, cleanup and stale-response protection.
- Backend and admin TypeScript checks, backend production build, Next.js production build, scoped lint, Prisma schema validation and Git whitespace checks passed.
- No environment files, secrets or lockfiles changed. No production booking or receipt was created as a test.
