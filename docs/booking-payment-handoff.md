# Tuljai Stays booking and payment handoff

Updated 2026-10-29, Asia/Calcutta. This report describes local code and isolated tests. Production has not been changed.

## Repository baseline

- Initial checkout: `main`, `ac78961b94f3c6dbcb15ba98fc5314d5d93186df`. Only `docs/project-intelligence/` was untracked; it was preserved.
- Fetch found `origin/main` at `8ccc63076fb39f94db8575f1663e77cea21db2d6`, three commits ahead of local main. These allow zero `totalRooms`, add the authorized management room-type endpoint, and use it in admin.
- Existing remote branch `fix/price-availability-sync` at `448a09da7670272604d48cfa2311a8d5598b0158` contains exactly five subsequent commits and five changed files. Full diffs were inspected. The local tracking branch was checked out to continue that work. No merge, rebase, reset, clean, force-push, or deployment was performed.
- GitHub CLI returned no PR for that branch, including closed PRs. No duplicate PR was created.
- Render's backend is live at `8ccc6307`, before those five fixes. Both services track main with automatic deployment enabled. A merge/push to main could deploy automatically and run migrations; approval must precede that action.
- Stack observed: npm workspaces, Node 22.23.0 locally, manifests request npm 10.8.0, Nest 11, Prisma/PostgreSQL adapter 7.x (installed client/CLI 7.9.0), Next 16.2.11 in the build, Expo 57, React Native 0.86.2, React 19.2.3. Razorpay is declared as `^2.9.8`, but the active provider uses HTTP `fetch` against the v1 API; mobile uses `react-native-razorpay`.
- `rtk` was unavailable. Native PowerShell/Git/npm commands were used after disclosing this limitation.

## Confirmed causes and changes

| Area                      | Evidence and resulting behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue synchronization | Claude correctly found missing server invalidation and owner catalogue events in `rooms.service.ts`. Its cache invalidation could still be undone by an older in-flight catalogue read; `catalog.service.ts` now guards cache population with a generation. Owner polling previously stopped while sockets were connected; it now reconciles every 30 seconds and rejects older responses. Owner cache keys include account and lodge. Pilgrim refreshes on reconnect and foreground intervals, guards detail hydration and private snapshots, and preserves a legitimate empty catalogue instead of substituting mock lodges.                                    |
| Admin save                | `totalRooms: 0` validation and management listing fixes are present on remote main. The admin catch-all public-list fallback could hide failed management requests; it was removed. Owner management uses the same authorized endpoint. Room-type and status changes now persist their audit entry in the same transaction. A failed save rolls back and a retry can succeed.                                                                                                                                                                                                                                                                                     |
| Distributed idempotency   | Claude's process-local map could return another request's in-flight result before verifying that caller. It was removed. `Booking.sourceLockId` is database unique, and consumption is conditional on the hold still being active and unexpired. Allocation, booking, paid collection, histories, audit, and intent completion commit together for hold-first payments. Existing payment-collection payment-ID uniqueness is retained.                                                                                                                                                                                                                            |
| Inventory                 | Shared room-type row locks cover hold creation, hold consumption, prepaid allocation, manual reservations, owner acceptance, cancellation, and legacy verification. Room selection checks active physical rooms, overlapping bookings, and date blocks. Manual reservations retain the `(room_id,date)` uniqueness guard and never overwrite a conflicting night. This is an application transaction protocol; it is not an exclusion constraint protecting arbitrary direct SQL writers.                                                                                                                                                                         |
| Pricing                   | All booking paths previously multiplied base price by nights. `booking-pricing.ts` now sums explicit `room_pricing` overrides with Decimal arithmetic and base-price fallback. Checkout receives a server stay quote, and Razorpay amount, stored order amount, and paid booking amount use the same frozen order value. The legacy prepaid endpoint delegates to the authoritative booking service. The user confirmed that festivalPrice applies within configured festival start/end dates, inclusive; explicit per-date overrides win. No extra taxes, discounts, or customer commission charges were invented. Existing commission triggers remain in place. |
| Recovery                  | No existing webhook/reconciliation route was found. Payment intents and a minimal webhook inbox now support recovery without a mobile callback. The raw-body HTTP route was tested. Gateway order/payment, captured state, INR currency, and exact integer subunit amount are checked. Duplicate/late failure events cannot demote confirmed intents.                                                                                                                                                                                                                                                                                                             |
| Display labels            | Reviews/feedback now receive lodge names and a display name from an admin-only join; public review responses do not gain that private name. QR monitor and dashboard scans receive lodge names. Booking/commission reports carry names; CSVs retain an additional ID column for reconciliation. Photos/revenue use appropriate labels. Existing pilgrim/owner booking mappers already provided lodge/room labels; identifiers used for navigation, keys, relations, and operational reconciliation were retained.                                                                                                                                                 |
| Privacy                   | The owner report filter previously allowed a requested lodge ID to replace the authorized lodge set; filters now intersect both. Contact lifecycle guards were retained and tested. New tables enable RLS and revoke public/anon/authenticated access. Guest intent details are not logged and are cleared after confirmation. No latitude/longitude fields were reintroduced.                                                                                                                                                                                                                                                                                    |
| Availability performance  | The old availability service made per-room conflict queries. A ten-room fixture measured 46 queries on the original branch implementation and 6 after batched relation filtering, including the added pricing query. The measured fixture has no standalone festivalPrice; configuring one adds a batched settings read. This is a query-count measurement, not a production latency benchmark.                                                                                                                                                                                                                                                                   |
| Checkout latency          | Provider requests now have a 15-second timeout and emit operation/duration only. Hold preparation emits authorization, hold, order, and total durations; mobile emits preparation duration in development. The duplicate payment-setting read in the combined hold path was removed. Live Render latency returned an empty series for the hold endpoint; no before/after checkout latency claim is made.                                                                                                                                                                                                                                                          |

## Payment lifecycle and API compatibility

1. Existing hold/order endpoints remain. A hold reserves capacity for the configured TTL. An order is stored while the hold row is locked, so concurrent order requests reuse the stored order. External order creation can leave an orphan order if the network fails before persistence; that order is never returned for checkout and does not debit a customer by itself.
2. Updated clients call `POST /api/payments/prepaid/prepare` with validated booking details before opening the SDK. The server checks ownership and the uploaded proof and freezes one guest snapshot. A payment intent stores the expected amount/currency and unique order ID. Updating details after preparing an order requires returning to a fresh checkout; recovery uses the frozen details.
3. The app stores only the pending order reference under the signed-in account before opening Razorpay. A restart/retry checks that order before starting another payment. The SDK's error/dismissal alone is not treated as proof that no debit occurred.
4. The client confirmation signature is checked on every request. A captured payment is fetched from Razorpay and matched against the stored order, owner, amount, and currency. The final database transaction creates one booking and collection. Retries return the original booking.
5. `POST /api/payments/razorpay/webhook` verifies `X-Razorpay-Signature` against the exact raw bytes using the separate webhook secret. `X-Razorpay-Event-Id` is the durable inbox key. Supported events are `payment.captured`, `order.paid`, and `payment.failed`. Only event/order/payment references are stored, not the payload's contact or card data. Acknowledgement follows durable inbox persistence.
6. A 30-second scheduler processes due intents, with database compare-and-update leases and exponential backoff capped at one hour. It uses Razorpay's fetch-payments-for-order API. Webhooks accelerate the next check; polling also works when events are missed. Transient hold-first database/storage failures remain retryable. Allocation/domain failures become `RECOVERY_REQUIRED`.
7. `GET /api/payments/orders/:orderId/status` is scoped to the pilgrim. It reconciles with the gateway. If there is no captured/authorized payment and the original hold remains active, it can offer the same order for resumption, showing the original lodge, dates, and amount. It does not create a replacement charge. A failed gateway attempt does not close an otherwise reusable order; the intent remains pending while that order can still be retried.
8. A captured payment after hold expiry, an unavailable room, amount/currency mismatch, or missing historical guest snapshot does not fabricate a booking. The intent retains the payment reference and a safe error code for operator review. No untracked automatic refund or false refund-success message is issued. Refund initiation and its idempotent financial workflow remain an operational follow-up; no production refund was performed.
9. `GET /api/payments/recovery`, protected with existing ADMIN authentication/roles, exposes bounded recovery records and unmatched webhook references, excluding guest snapshots. This is an operator API; a new recovery dashboard was not fabricated.
10. Historical booking-first orders are also reused and verified under database locks. Their booking/payment updates are atomic. They retain their existing booking-first response shape. Older hold-first apps can still confirm with their guest DTO, but they cannot guarantee server-only recovery before sending those details; ship updated clients before relying on that guarantee.

Official references checked: [webhook signatures and ordering](https://razorpay.com/docs/webhooks/validate-test/), [order events](https://razorpay.com/docs/webhooks/orders/), and [fetch payments for an order](https://razorpay.com/docs/api/orders/fetch-payments/). The provider's active implementation is HTTP-based despite the SDK dependency.

## Idempotency inventory

| Operation                          | Durable protection / lifecycle                                                                                                                                         | Remaining limit                                                                                                                                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create hold                        | Room-type row lock serializes availability check and insert; expiry releases abandoned capacity; audit is atomic.                                                      | A request that loses the initial hold response has no caller-provided attempt key. A second hold request can create another temporary hold. It cannot duplicate a booking from the first hold. Do not describe hold creation as fully idempotent. |
| Create/reuse Razorpay order        | Hold or booking row lock, unique stored order reference, stored immutable amount; same order is returned on retry.                                                     | A gateway timeout during order creation can produce an unused orphan gateway order.                                                                                                                                                               |
| Create cash/legacy pending booking | Unique source hold plus conditional consumption and inventory lock; booking/history/audit and online pending collection commit together.                               | A client that deliberately starts a new hold is a new logical reservation; no arbitrary cross-checkout deduplication was added.                                                                                                                   |
| Confirm hold-first payment         | Unique source hold, unique gateway payment collection, unique intent order/payment/booking; one transaction for allocation and all financial linkage.                  | Expired/unavailable holds require recovery; retries never promise a room that no longer exists.                                                                                                                                                   |
| Verify booking-first payment       | Booking and room-type locks; fresh FULLY_PAID check; collection and booking mutate together.                                                                           | Legacy post-commit intent-update failures can require another verification/recovery run; booking and collection remain consistent.                                                                                                                |
| Receive webhook                    | Unique event ID; durable minimal references; confirmed state is monotonic; gateway reconciliation is authoritative.                                                    | Delivery activation needs the dashboard secret/configuration. Unknown orders remain visible as unmatched events.                                                                                                                                  |
| Recovery scheduler                 | Persistent intent, conditional lease on prior `nextCheckAt`, bounded batch, backoff, same allocation transaction as callbacks.                                         | Process restart can repeat a gateway read; that does not repeat booking creation. Pending/abandoned intent retention and operator triage need an operating policy.                                                                                |
| Manual owner reservation           | Same inventory lock plus unique room/date rows; any conflicting night rolls the transaction back.                                                                      | No persistent client attempt key; a retry after success returns a conflict rather than the original manual block.                                                                                                                                 |
| Admin price/status save            | Audit and mutation share a transaction; cache generation and client response revisions prevent regression. Duplicate events refetch current state.                     | Same-value retries can create another audit entry. No external business side effect is tied to those entries.                                                                                                                                     |
| Owner acceptance                   | Inventory lock, fresh pending-state check, allocation/history in one transaction.                                                                                      | Repeated acceptance returns a conflict; it does not allocate a second room.                                                                                                                                                                       |
| Cancellation                       | Existing ownership/status policy, row/inventory lock, fresh status check, repeated cancelled state returned; occupied/maintenance/blocked rooms are not blindly reset. | Refund accounting is not automatically implemented by cancellation. Other register/checkout/admin status transitions still deserve a broader idempotency follow-up.                                                                               |

## Database migration and deployment blockers

The new additive migration is `backend/prisma/migrations/20261028180000_payment_recovery/migration.sql`.

- Adds nullable, unique `bookings.source_lock_id`. Existing bookings stay null; no historical relationship is guessed.
- Adds payment intents and webhook inbox with unique references, status/amount checks, due-work index, RLS, and revoked API-role access.
- Backfills legacy booking-first orders from persisted booking/collection values and historical bound holds from their stored amount. Existing bookings/payment rows are not rewritten. Historical holds without guest snapshots remain explicitly recoverable by an operator.
- Ambiguous order/booking collection groups or invalid legacy booking amounts abort the transaction. Explicit BEGIN/COMMIT prevents partial new-schema installation on these failures. Preflight must be repeated immediately before deployment.
- Live read-only checks found 46 bookings, zero duplicate order/payment groups, zero overlapping confirmed room pairs, zero date-price rows, zero multiple order collections per booking, zero invalid legacy amounts, and 19 bound holds. This is a snapshot, not a guarantee about future writes.
- Live migration metadata was reread: 27 finished, none rolled back. The missing `20260819000000_fix_commission_effective_date_and_backfill` was recovered from Git commit `8244b057` with an exact live-checksum match. The commission foundation file was restored from `9fd3ef55` with an exact live-checksum match. Four remaining records use manual-apply markers rather than real hashes; their schema effects require reconciliation. No live history records were edited. Preserve the existing audit's detailed evidence.
- Initial unmodified replay failed because the edited foundation SQL added a commission column twice. Restoring its exact applied source resolves that source drift. Two remaining replay hazards are a setting migration that assumes seeded data/defaults and a review-response table created twice with different shapes. These are existing-history problems, not fixed by the new migration.
- The final integration fixture makes two explicit adaptations: seeds the online-payment setting and skips the second review-response table creation. It does not edit migration files. `CHECK_MIGRATION_HISTORY=1` disables those adaptations and reproduces the history failure. Passing integration tests must never be described as passing unmodified migration replay.
- The local Prisma CLI's `migrate diff` returned no SQL despite exit 0 during initial fixture setup. That result was rejected as verification. Tests instead apply the explicit migration fixture and assert real database behavior.

Deployment sequence, only after approval:

1. Reconcile the remaining manual-apply records and historical replay assumptions against the live schema, including finance triggers. Verify backups and a restore procedure. Do not reset or silently rewrite `_prisma_migrations`.
2. Run the duplicate/amount preflight again, rehearse the additive migration against an isolated production-shaped copy, and verify the backend connection role can write the RLS-protected new tables.
3. Apply the reviewed migration, generate Prisma client, and deploy backend code. Render currently invokes migration deployment in both build and start commands; account for that when approving a release.
4. After explicit approval for an isolated staging deployment, configure staging `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` with test-mode credentials and a separate test database. Set `RAZORPAY_WEBHOOK_SECRET`, distinct from the API key secret. No values belong in Git.
5. In Razorpay test mode, configure `https://<approved-staging-host>/api/payments/razorpay/webhook` with the three supported events. The eventual production endpoint is `https://tuljai-stays-backend.onrender.com/api/payments/razorpay/webhook`; leave it inactive until release approval. Verify genuine signed delivery, duplicates, callback loss, gateway timeout, delayed capture, expired hold, and reconciliation/triage before live activation. Dashboard access and test credentials were not supplied in this task.
6. Ship updated mobile clients after the compatible backend. On-device verification is required for native SDK launch, SecureStore restart recovery, UPI/bank return, app dismissal, and the resumed-order prompt. Mobile binaries were not built or published here.
7. Watch recovery queue/unmatched events, pending-intent age, scheduler errors, booking/payment counts, inventory conflicts, and the new timing logs. No production timing series was available for this endpoint.

Rollback: retain new additive columns/tables and durable financial records. Disable webhook delivery/recovery traffic deliberately if rolling back application code; preserve pending references for reconciliation. An app rollback does not reverse gateway payments or bookings. Do not drop new records or run a destructive down migration as an automatic rollback.

## Verification record

Commands are run from `D:\Tuljai-Stays`, unless otherwise noted. Final command results are recorded in the accompanying verification section before handoff.

- `npm run db:generate`: passed, generated installed Prisma 7.9.0 client locally; no database mutation.
- `npm exec -- prisma validate --schema backend/prisma/schema.prisma`: passed.
- `npm run typecheck`: PASS across every workspace after the implementation.
- `npm run build`: PASS (exit 0), including admin production compilation/55 pages and backend build. `npm run build:backend` also passed after the final backend changes.
- `npm run test --workspace @tuljai/backend`: PASS, 15 unit/HTTP/event tests; the database suite deliberately skips without TEST_DATABASE_URL. A prior HTTP-test run exceeded its initial 30-second timeout while both Expo exports were running; the bounded test timeout is now 120 seconds and the isolated rerun passed.
- Isolated PostgreSQL integration: use a new empty loopback database whose name begins `tuljai_test_`. Tests refuse remote or nonempty databases. Supply TEST_DATABASE_URL to run `node --test backend/scripts/booking-integration.test.mjs`. No production URL is read from `.env` for this fixture.
- A portable PostgreSQL 18.4 binary was installed only under ignored `.codex-temp/pg-test/`, with synthetic local databases and no application dependency/lockfile change. CI uses PostgreSQL 17. The new workflow runs the same unit/integration tests on PRs and this branch.
- Integration coverage includes separate-connection duplicate confirmation, last-room competition, rollback after collection insert, recovery/client race, repeated verification, date pricing, concurrent holds, manual/prepaid contention, admin persistence/error/retry, query-count regression, historical recovery, failed-attempt resumption, and expired paid holds.
- Unit/HTTP coverage includes raw webhook bytes, invalid signatures, duplicate/out-of-order events, amount mismatch, caller isolation, lodge-contact policy, owner report scope, and cache invalidation during an older fetch.
- `npm run lint`: PASS across every workspace. The previous remote CI run at `448a09da` failed on the PNG require in PilgrimPassScreen; the typed static import fixes it locally. New local changes are uncommitted/unpushed, so no remote CI success is claimed.
- `npm exec --workspace @tuljai/pilgrim-app -- expo export --platform android --output-dir ../../.codex-temp/pilgrim-export`: PASS. Repeated with `--max-workers 2` after the booking-event helper change; PASS.
- `npm exec --workspace @tuljai/owner-app -- expo export --platform android --output-dir ../../.codex-temp/owner-export`: PASS.
- `npm run format:check`: FAIL on 755 local files (744 tracked), with zero warnings in changed tracked files. Existing files/audit artifacts were not mass-reformatted. The scoped Prettier check of changed/new source, tests, workflow, and documentation passed.
- `CHECK_MIGRATION_HISTORY=1` with the isolated test runner: FAIL as expected on `20260819090000_sync_online_payment_setting`, which assumes a seeded/defaulted system_settings ID. This is separate from passing application tests against the documented fixture.
- `git diff --check`: PASS. Original two recovered SQL files retain exact live-recorded SHA-256 bytes; no history-table rewrite or production migration occurred.
- No signed APK/native build, real-device checkout, authenticated production booking mutation, genuine Razorpay sandbox payment, live webhook delivery, production migration, or deployed UI verification was executed. Android exports verify JavaScript/Hermes bundling only.
- A names-only configuration check found local Razorpay API key, API secret, and webhook secret unconfigured. Values were neither printed nor copied.

## Remaining limits / decisions

- Confirmed business rule: apply standalone `festivalPrice` within configured festival start/end dates, inclusive. Explicit RoomPricing overrides win; the display-only festival-mode flag does not override those dates. Missing window uses base price; malformed or partial windows fail visibly.
- Define retention/triage for abandoned pending intents and signed webhook references. Confirmed intents clear their temporary guest snapshot. Historical captured holds without guest details need an operator to recover details or arrange a verified refund.
- The earlier audit listed additional authentication/MFA/admin-role, notification-retry, readiness, dependency, and mobile route-provider concerns. They were not all independently resolved by this booking-focused change. The existing audit files were preserved; these remain separate security/stability work, not verified fixes.
- No claim is made that every screen or export has been exercised on a device. The raw-ID source audit fixed the concrete display sites found; internal correlation IDs remain where needed.
- Hold creation and manual-booking replay do not yet have caller-persisted attempt keys, as detailed above. Their inventory protections prevent overwriting/overselling, but full request-replay UX is a follow-up.
- No merge/deployment/production payment-setting changes are authorized by this handoff. Required next actions are historical migration reconciliation, secure test credentials/dashboard setup, device tests, and explicit release approval.

## Final local verification summary

- Combined isolated run: PASS, 15 unit/HTTP/event scenarios plus 20 PostgreSQL integration scenarios. Node reports 36 passing tests because it also counts the parent integration test. No failures or skips in the combined run.
- The portable runner used `TEST_DATABASE_URL` for a new local database; the equivalent committed command is `npm run test --workspace @tuljai/backend` with that variable set. CI supplies an isolated PostgreSQL 17 service. The local run used PostgreSQL 18.4.
- All workspace type checks and ESLint commands passed. Full admin/backend build and both Android exports passed; the final backend build also passed after the last recovery-state edit.
- The historical-source failure is deliberately separate: unmodified migration replay still fails on the old setting seed assumption. Four manual-apply history records and the duplicate review-response-table history remain release-review items.
- The selected ten-room performance comparison is 46 original availability queries versus 6 current queries, with no standalone festival rate in that fixture. No production checkout timing improvement has been measured.
- No genuine gateway call/payment or production mutation occurred. No Razorpay test credentials or webhook secret are configured locally. Refund automation, persistent initial-hold/manual-request replay keys, live delivery activation, retention/triage policy, and device testing remain limitations detailed above.

## Review manifest

Every path below is a change from the checked-out Claude branch. The root-cause table above explains each group. The original untracked project-intelligence directory is excluded and preserved. No root dependency lockfile changed. Changes remain uncommitted and unpushed on the existing tracking branch.

- `.github/workflows/booking-reliability.yml`
- `apps/admin-panel/app/admin/dashboard/page.tsx`
- `apps/admin-panel/app/admin/feedback/page.tsx`
- `apps/admin-panel/app/admin/performance/page.tsx`
- `apps/admin-panel/app/admin/photos/page.tsx`
- `apps/admin-panel/app/admin/qr-monitor/page.tsx`
- `apps/admin-panel/app/admin/reports/page.tsx`
- `apps/admin-panel/app/admin/revenue/page.tsx`
- `apps/admin-panel/app/admin/reviews/page.tsx`
- `apps/admin-panel/src/api/admin-governance-api.ts`
- `apps/admin-panel/src/bookings/booking-operations.ts`
- `apps/owner-app/src/features/rooms/api/owner-rooms-api.ts`
- `apps/owner-app/src/features/rooms/hooks/useRoomOperations.ts`
- `apps/owner-app/src/features/rooms/storage/room-board-cache.ts`
- `apps/pilgrim-app/src/features/bookings/api/bookings-api.ts`
- `apps/pilgrim-app/src/features/bookings/payment-recovery-store.ts`
- `apps/pilgrim-app/src/features/bookings/useStayPrice.ts`
- `apps/pilgrim-app/src/pilgrim-ui/PilgrimAppProvider.tsx`
- `apps/pilgrim-app/src/pilgrim-ui/backend-sync.ts`
- `apps/pilgrim-app/src/pilgrim-ui/booking-state.ts`
- `apps/pilgrim-app/src/pilgrim-ui/screens/PilgrimCheckoutScreen.tsx`
- `apps/pilgrim-app/src/pilgrim-ui/screens/PilgrimPassScreen.tsx`
- `apps/pilgrim-app/src/pilgrim-ui/useRoomAvailability.ts`
- `apps/pilgrim-app/src/v2/core/booking.ts`
- `apps/pilgrim-app/src/v2/features/booking/BookingScreen.tsx`
- `backend/.env.example`
- `backend/package.json`
- `backend/prisma/migrations/20260816000000_lodge_commission_accounting/migration.sql`
- `backend/prisma/migrations/20260819000000_fix_commission_effective_date_and_backfill/migration.sql`
- `backend/prisma/migrations/20261028180000_payment_recovery/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/scripts/booking-integration.test.mjs`
- `backend/scripts/payment-regression.test.mjs`
- `backend/src/main.ts`
- `backend/src/modules/bookings/booking-availability.service.ts`
- `backend/src/modules/bookings/booking-locks.service.ts`
- `backend/src/modules/bookings/booking-pricing.ts`
- `backend/src/modules/bookings/bookings.service.ts`
- `backend/src/modules/bookings/inventory-lock.ts`
- `backend/src/modules/bookings/prepaid-bookings.service.ts`
- `backend/src/modules/bookings/qr-checkin.service.ts`
- `backend/src/modules/catalog/catalog.service.ts`
- `backend/src/modules/operations/operations.service.ts`
- `backend/src/modules/payments/payment-recovery-scheduler.service.ts`
- `backend/src/modules/payments/payments.controller.ts`
- `backend/src/modules/payments/payments.module.ts`
- `backend/src/modules/payments/payments.service.ts`
- `backend/src/modules/payments/providers/razorpay.provider.ts`
- `backend/src/modules/reviews/reviews.service.ts`
- `backend/src/modules/rooms/rooms.service.ts`
- `docs/booking-payment-handoff.md`
- `packages/types/src/booking.ts`
- `packages/types/src/operations.ts`
