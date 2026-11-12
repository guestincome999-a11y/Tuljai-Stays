# Instant owner QR check-in

## Named lodge collection step — live, 3 November 2026

Commit `7cd869c69157e2db5bbb9de8083c4943c574159e` is pushed to `main`. Backend deployment `dep-dbksa2s9v7es73d0io2g` and admin deployment `dep-dbksa2s9v7es73d0insg` both reached `live`. Pay-at-lodge collection is displayed before Check-in as a workflow step. It starts pending without a timestamp, then displays `Payment Collected by <collector name>` with the real server-recorded confirmation time in IST. Its visual position does not alter actual check-in or collection timestamps.

Collector name and confirmation request time are saved with the existing audit entry; the same time is used on the receipt. Idempotent retries preserve both. Older receipts fall back to the same lodge's linked collector name. No migration or APK rebuild was required for this update. Backend health returned HTTP 200 and the collection route retained its HTTP 401 authentication guard. The live admin page and its booking asset returned HTTP 200 and contained the updated flow, pending step and IST formatting. No production payment was created as a test.

Validation: 23 focused cash/activity/admin-refresh tests passed, with 1 optional database test skipped in that run; all 14 cash tests passed against local PostgreSQL. Both production builds, backend/admin TypeScript checks, scoped lint and whitespace checks passed. The targeted changes are also synced to the original checkout, preserving unrelated work.

## Approved cash collection and admin timeline release — live, 3 November 2026

Published commit `9a9c3a1c171e7e2b90e4cc565f7dec677547746d` to `main` after approval. Backend deploy `dep-dbkri649v7es73cvk18g` and admin deploy `dep-dbkri649v7es73cvk1mg` both reached `live`. Render logged successful application of migration `20261102120000_owner_cash_collection` and completion of all migrations. The collection route now rejects an unauthenticated invalid-ID/empty-body probe with HTTP 401 instead of the earlier HTTP 404. Live backend health is HTTP 200. No real booking or payment was mutated by these smoke tests.

The deployed admin booking detail page includes the recorded booking and payment timeline, amounts, actors when available and explicit IST timestamps. The live page and its booking-detail JavaScript asset returned HTTP 200; the deployed asset contains the new timeline and Asia/Kolkata formatting. Query behavior and the single cash receipt appearing once in the timeline were verified against the local real PostgreSQL fixture. Missing legacy event timestamps are not fabricated.

Release validation: 48 backend tests passed, 2 optional database cases skipped; all 13 cash tests passed against local PostgreSQL; 2 admin realtime/stale-response tests passed. Backend/admin type checks, both production builds, scoped lint, Prisma validation and whitespace checks passed. Unrelated original-checkout changes were retained. The release was assembled in `.codex-temp/cash-admin-release` from the verified live `main` baseline, not by publishing the entire dirty owner-app branch. The existing installed app can now call the collection endpoint without a new APK.

## Live cash-collection endpoint diagnosis — 3 November 2026

A deliberately unauthenticated POST with an invalid UUID and an empty body to the configured Render backend returned HTTP **404**, `Cannot POST /api/owner/bookings/not-a-valid-uuid/collect-payment` (request ID `req-vwj`). No booking or payment was submitted. This establishes that the running server has no collection route; the installed app cannot record this receipt until the backend endpoint and migration are released.

The app now translates only a 404 `Cannot POST` collection response into an explicit server-unavailable/payment-not-recorded message. Actual booking-not-found and permission errors remain unchanged, and no automatic payment-write retry was introduced. All **40 owner tests passed**; cash backend unit tests **12 passed**, with the optional real-database test skipped in this run. Owner/backend type checking, backend build, scoped lint, and whitespace checks passed.

A focused eight-file backend release patch is prepared at `outputs/cash-collection-backend.patch`, based on local commit `cdc912fb`. It includes the protected endpoint, amount DTO, atomic receipt helper, response metadata, realtime refresh event, unique-index migration, and cash regression tests. It excludes unrelated working-tree changes. The live service's source branch must be verified before applying the patch to its release branch. No commit, push, production migration or backend deploy has been performed.

## Deployed scanner compatibility and booking link — 3 November 2026

The deployed backend rejects an additional `idempotencyKey` body property with `property idempotencyKey should not exist`. The owner scan API now explicitly serializes only the existing `deviceId` and signed `qrPayload` fields. The durable queue still uses its stable token-derived operation key; backend token validation is unchanged. This client compatibility fix does not require a new backend DTO to be deployed.

The existing result card now includes **Open Booking**, using the recognized booking UUID and the existing owner booking-detail route. It is available immediately, offline, and after a check-in failure, independently of the guest-register action. Opening details does not mark check-in successful or stop the app-level processing queue.

Regression coverage includes the deployed strict request shape, opening booking details before HTTP starts, navigating after a terminal check-in failure, and absence of a booking action for invalid QR data. All **37 owner tests passed**, including the existing deliberately delayed 2.5-second response test. Owner TypeScript checking, scoped lint, diff whitespace checks, and the Android production bundle export passed. No production booking was checked in during validation.

The corrected Android preview was submitted as build **20**, ID `0b8af361-239c-497c-a80c-f032b718a941`: https://expo.dev/accounts/jay9529/projects/tuljai-stays-owner/builds/0b8af361-239c-497c-a80c-f032b718a941. Build 19 does not contain this request compatibility fix or the Open Booking button. The submission command completed successfully after fingerprinting; submission alone does not mean an APK is ready.

## Payment result layout update — 2 November 2026

The previous result-card order is restored: status, payment guidance, guest name, booking reference, room, guest count, check-in time, and register/scan-next actions. The collection amount uses bold 20-point text inside the existing payment banner. The large result icon and additional lodge/detail layout have been removed. The scanner still renders its result before backend processing.

Payment guidance is now displayed immediately from cached booking details. If those details are missing, the existing owner booking endpoint loads them independently after the result paints, so payment information does not wait for check-in processing. Fully paid bookings show Paid Booking and nothing to collect. Advance-paid bookings show the remaining balance; an unknown balance is never replaced with the full booking total.

After a server-confirmed check-in, pay-at-lodge bookings have a Collected button. It requires two consecutive Yes/No confirmations, each showing the amount and booking reference. Either No cancels without an API call. Offline collection and duplicate submissions are disabled. The UI updates to Payment Collected only after server confirmation; cash payments retain the PAY_AT_LODGE method and are never labelled as online payments.

The new owner/staff-authorized endpoint is `POST /owner/bookings/:id/collect-payment`. It validates lodge access, checked-in status, payment method, and the amount displayed in the confirmations. A booking row lock, deterministic receipt reference, and partial unique index prevent duplicate collections across devices and retries. The receipt, zero remaining balance, and audit entry commit atomically using existing payment collection infrastructure. Partial/refunded adjustments require review instead of blindly recording another full receipt.

Deploy migration `20261102120000_owner_cash_collection` and the updated backend before enabling the collection button in a new app build. No production database changes or deployment were performed by this update.

An updated Android preview was submitted to EAS with `build --platform android --profile preview --non-interactive --no-wait`: build number **19**, build ID `68b17bde-c748-41d4-b5ff-2a137cc26f80`. Track the cloud build at https://expo.dev/accounts/jay9529/projects/tuljai-stays-owner/builds/68b17bde-c748-41d4-b5ff-2a137cc26f80. Submission is not a completed APK or production release.

Validation for this update: owner tests **33 passed**; backend suite **56 passed, 2 optional database tests skipped**; cash collection tests with the disposable real PostgreSQL database **13 passed**, including concurrent requests, amount mismatch, and unauthorized owner access. Owner/backend type checks, backend build, and scoped lint passed. The existing 2.5-second delayed check-in test still passes with payment guidance visible while check-in is pending.

Implemented locally on `codex/owner-native-redesign`, 1 November 2026. Existing working-tree changes were retained. No commit, push, deployment, migration, or environment-file edit was performed for this task.

## Root cause and execution sequence

`CameraQrScannerScreen.handleScanned` previously awaited device identity storage and `scanQrCode` before setting its result. The endpoint performs verification, booking/token writes, register creation, notifications, and booking retrieval. All that latency preceded the result. Offline scans were rejected outright.

The new sequence is:

1. A synchronous ref gate accepts one camera callback and locally decodes the existing signed QR envelope.
2. React displays **QR Scanned** and the booking reference, plus already cached booking details when available. The camera unmounts. Local recognition does not verify the signature or authorize a stay.
3. After the result commits, two animation-frame callbacks yield a paint before starting persistence or HTTP work.
4. An app-level queue saves the operation durably, then obtains the device identity and calls the existing `/qr/scan` endpoint.
5. Backend confirmation updates the same screen to **Check-In Successful** or **Already Checked In**. Terminal errors explicitly say check-in could not be completed. Payment guidance appears independently from cached or asynchronously fetched booking details; the guest register becomes available after confirmation.
6. A local `checkin:completed` event and connection revision update feed existing booking/dashboard refresh hooks even if the socket missed an event. Existing server realtime notifications remain in use.

The two independent layers are `RecognitionStatus` and `CheckinStatus` in `scan-operation.ts`. There is no optimistic booking status change. Recognition immediately sets UI state; queue and HTTP state cannot delay that render. No fixed real-device latency is claimed.

## Persistence, retry and navigation

The queue uses the existing React context architecture above screen navigation. It survives scanner navigation. Native pending records use the existing Expo SecureStore dependency, with separate owner namespaces and small per-token records; web uses the app's existing local-storage accessor. No new dependency was added.

Each record contains only the original signed QR envelope and its derived reference/operation identity, not guest contact information or auth credentials. A serialized index points to at most 40 pending operations. Completed records are removed from durable storage; current-session recent results remain available on the scanner. Startup restores pending work and exposes it in Recent scans. Unreadable storage reports an error rather than silently dropping pending scans.

Check-in requests only start after a durable write. Scan Next Guest waits for that write, never the backend response. A storage failure offers Retry saving scan and does not submit HTTP work.

Offline scans display **Waiting for connection - pending verification**. Connection recovery, app foregrounding, and a 15-second foreground retry timer retry pending requests. Network/server errors, rate limits, authentication interruptions, and transient conflicts remain pending. The OS is not asked to execute work while the app is suspended or terminated; persisted work resumes when the app runs again.

Cached display details come from existing owner booking list/detail responses. The memory cache resets when the authenticated owner changes, and a revision guard prevents late responses from repopulating a previous owner's cache. On a cold start without cached details, the reference appears immediately and an independent booking-detail request starts after the result paints.

## Backend correctness and security

The existing token ID is the durable local operation identity: `checkin.<qrTokenId>`. To remain compatible with the deployed DTO, owner requests send only the device ID and original signed QR payload. The updated backend optionally accepts an explicit key and checks it against the resolved token, but does not require it. The database token itself remains the deduplication authority, so different device IDs or client keys cannot bypass protection.

The transaction conditionally claims an ACTIVE, unused, unexpired token and an eligible, non-deleted booking with the expected room. Token consumption, booking/room status, history, successful scan log, guest register and register audit now commit together. Failure rolls everything back. The existing unique guest-register booking ID protects against duplicate registers. Register codes use the unique booking UUID rather than a racing count-plus-one generator. No schema change is needed.

Authorized retries of a used token return the existing register with `scanResult: USED`. A concurrent loser re-reads the committed token and returns that result. Replays do not repeat status/history/register/notification writes or add a DETAILS_VIEWED audit record. Unauthorized attempts retain the existing failure log/notification behavior.

HMAC validation, expiry, token state, booking eligibility, assigned room, JWT/role guards, and lodge ownership remain authoritative on the backend. Ownership is checked before returning replay data. Cancelled/deleted bookings are rejected. No signing secret is shipped to the owner app. The pilgrim's `tjsqr.v1` format and QR generator are unchanged; legacy raw-token API calls remain supported.

## Files changed for this task

- `apps/owner-app/src/features/checkin/screens/CameraQrScannerScreen.tsx`
- `apps/owner-app/src/features/checkin/scan-operation.ts` (new)
- `apps/owner-app/src/features/checkin/CheckinSyncProvider.tsx` (new)
- `apps/owner-app/src/features/checkin/storage/checkin-queue-store.ts` (new)
- `apps/owner-app/src/features/checkin/api/checkin-api.ts`
- `apps/owner-app/src/features/checkin/hooks/useScanHistory.ts`
- `apps/owner-app/src/features/register-dashboard/hooks/useRegisterDashboard.ts`
- `apps/owner-app/src/features/bookings/api/owner-bookings-api.ts`
- `apps/owner-app/src/realtime/realtime-provider.tsx`
- `apps/owner-app/scripts/checkin.test.mjs` (new)
- `apps/owner-app/package.json` (test command)
- `backend/src/modules/bookings/qr-checkin.service.ts` (retains prior uncommitted work)
- `backend/src/modules/bookings/guest-register.service.ts`
- `backend/src/modules/bookings/dto/qr-register.dto.ts`
- `backend/scripts/qr-checkin.test.mjs` (new)
- `backend/package.json` (append QR tests to existing test command)
- This report.

## Executed validation

- Owner suite: `node --test scripts/owner-ui.test.mjs scripts/checkin.test.mjs` — **26 passed**.
- Backend suite: `node --test scripts/auth-session.test.mjs scripts/payment-regression.test.mjs scripts/payment-idempotency.test.mjs scripts/booking-integration.test.mjs scripts/qr-checkin.test.mjs` — **44 passed, 1 skipped**. The loopback PostgreSQL integration test requires `TEST_DATABASE_URL`, which was unset.
- QR regression tests — **12 owner tests and 12 backend tests passed**, including the final automatic history refresh regression.
- Owner and backend TypeScript checks (`tsc --noEmit`) — **passed**.
- Owner full lint — **passed**. Scoped lint for changed production/test files — **passed**.
- Full backend lint — **failed on 12 existing errors** in `scripts/auth-session.test.mjs` and `scripts/booking-display.test.mjs`; those files were left alone.
- Nest backend build — **passed**.
- Expo Android production bundle export — **passed**; this is a JavaScript/Hermes bundle export, not an APK/AAB or an iOS native build.
- Prisma schema validation — **passed**. This task adds no migration or schema edits.
- Final Git diff and whitespace check — inspected; existing unrelated changes retained. No secrets or environment files were edited for this task.

The mandatory delayed test executes the real scanner component with deterministic hooks and native host stubs. It asserts that QR Scanned is in the rendered element tree and the camera is removed before HTTP starts, then keeps the backend response unresolved for 2.5 seconds and verifies the result updates after confirmation. Queue tests cover duplicate callbacks/enqueue, disk-before-network, network failure/reconnect, durable restart, owner isolation, failures and used-token responses. Backend tests cover valid signed/legacy QR, tampering/expiry, cancellation, unauthorized replay, simulated simultaneous devices, and register rollback.

These are automated component/service tests, not real-camera measurements. The concurrency fixture models transactional serialization and rollback; live PostgreSQL contention, on-device SecureStore/restart behavior and native camera rendering still need a device/staging acceptance run. The skipped live database test must not be counted as passed.

## Rollout

Deploy the backend first, then publish/build the owner app update. The new DTO field must be accepted before the new app sends it, and the app relies on the new used-token replay behavior. Existing pilgrim QR codes and older owner callers remain compatible with the updated backend. Deployment/publishing was not requested or performed. The existing `npm` launcher is blocked by NVM's changed-script trust record, so validation invoked installed tools directly with Node. `rtk` was unavailable on PATH; normal tool invocations were used after checking availability.
