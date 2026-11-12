# Expo preview readiness — 29 October 2026

The preview should wait for the backend catalogue correction to be deployed and verified. Changes in this audit are local. No production data, payment, deployment, EAS build, or repository history was changed by this audit.

## Live checks

- Render backend and admin both report live commit `94b2e6191c4e6e7f249a1aaf9a1534ea444fcbc5`, deployed today. This supersedes the older deployment observations in `booking-payment-handoff.md`.
- `/api/health`: HTTP 200; database, realtime, storage and Firebase report ready/configured.
- Compared all ten publicly returned room types across six lodges with a read-only Supabase query. Names, IDs, ordinary/festival prices, adult/child capacities and total room counts matched. No production price was edited.
- Existing prices include Maharashtra Seva Dharamshala / Seva Twin Room at ₹1 and Jay / King Ping at ₹9.69. These are database values, not client calculation errors. Confirm they are intended before inviting external testers.
- Public room-type requests took 479–1,557 ms in six individual observations. One selected-date availability request took 1,596 ms and returned ₹1,099 for one ordinary night. These observations include network time and are not a production percentile benchmark.
- `/api/lodges/:id`, `/api/catalog/lodges`, and `/api/catalog/lodges/:id` returned HTTP 500. The independently accessible room-type and photo endpoints returned HTTP 200.
- Production `lodge_amenities` has `created_at`. Prisma's `LodgeAmenity.createdAt` lacked `@map("created_at")`, so loading the amenities relation selected a nonexistent column. A new isolated regression reproduced this error before the correction and passed after client generation.
- The authoritative `payment_settings` row enables Razorpay with `display_status = ACTIVE`. Public `enable_online_payments` is true. A separate historical `online_payments` feature flag is false; checkout authorization uses `payment_settings`, not that flag.
- Festival mode is enabled but both configured festival date boundaries are blank. The current pricing rule therefore uses ordinary rates unless an explicit per-date override exists. Merely setting festival mode does not activate every room's festival price.
- Both Render services use the free plan in Oregon; Supabase is in Southeast Asia. No hosting plan or region was changed. Render's queried HTTP latency series was empty, so no p95 or before/after latency claim is made.

## Incremental corrections

1. Corrected only the missing `LodgeAmenity.createdAt` database-column mapping. The existing database already has the correct column; no new SQL migration or data rewrite is required for this correction. Regenerate Prisma and deploy the backend.
2. Removed sample prices, room IDs, amenities, descriptions, room features, badges, locations and rules from live lodge business-data fallbacks. Cards and the lodge detail price now say “Price unavailable” when there are no loaded room types. Existing decorative photo fallbacks remain; approved backend photos take precedence.
3. Catalogue hydration no longer retriggers all private booking/notification fetches for every lodge update. Pending-booking polling skips background app states.
4. Font imports select the six used styles directly rather than loading font-package entry points containing unused styles.
5. The alternative `/book/:id` flow retains paise in displayed prices and exposes a prepared order only for its matching room/date selection. The original checkout already keys order prices by stay.
6. Added database coverage for public lodge details, amenities, catalogue cards and room details, and a regression for decimal rupee display.

## Validation

- Workspace type checks and ESLint passed before these incremental edits. Pilgrim type checking and backend build passed after the mapping and app changes; changed-file lint and Android export were checked again at the end.
- Isolated PostgreSQL run after the mapping fix: 42 passing tests, no failures or skips. This runner includes 24 database scenarios and the parent test plus 17 pricing/payment/HTTP regressions. It uses synthetic data in a new loopback-only database and stops that temporary server afterward.
- Subsequent standard backend test command: 25 passing tests, no failures, one database-suite skip because that command has no `TEST_DATABASE_URL`. This includes seven durable gateway-order tests and the newly added decimal-display regression. The database suite was executed separately as above.
- Final changed-file ESLint, pilgrim type check, backend build and Android production bundle export passed. Font narrowing reduced exported assets from 75 to 54 (21 fewer font assets); the Hermes bundle is still approximately 7.2 MB. This verifies Metro/Hermes bundling; it does not prove native Razorpay SDK launch, frame rate, or real-device startup latency.

## Checkout speed and remaining release work

The original checkout uploads ID proof immediately after selection and prepares the room hold and Razorpay order while the guest fills the form. On Pay, it still checks any pending payment, awaits preparation when necessary, calls `/payments/prepaid/prepare` to persist validated recovery details, and saves the pending order reference before opening the native SDK. Those recovery steps must not be removed to claim an instant checkout.

No device/emulator was connected for this audit and no genuine Razorpay payment was initiated. The SDK opening delay, payment success/cancel/retry experience, webhook delivery configuration and restart recovery still require an authorized device test. The isolated payment tests use synthetic gateway responses.

Before building the next Android preview:

1. Incorporate these narrow corrections on top of current main while preserving the existing dirty checkout and unrelated changes. The current local branch is still `fix/price-availability-sync`; a cloud build of its unchanged Git ref will not include the local corrections.
2. Deploy the corrected backend with regenerated Prisma client; verify both public detail and catalogue routes return HTTP 200. Existing Render build/start commands run the repository's migrations, so review the exact release source before triggering deployment.
3. Confirm the ₹1/₹9.69 prices and configure festival boundaries if festival rates are intended for the preview dates.
4. Build the pilgrim app with the existing `preview` EAS profile (internal Android APK, production API URL, mocks disabled). The latest existing preview is build 39 from October 25, at commit `ac78961b`; it predates today's fixes.
5. On the installed preview, verify an admin price/detail edit reaches the app, compare the final quoted total with Razorpay, measure Pay-to-sheet time, and test cancellation/resumption and confirmation recovery.

Official platform references read during the audit: [Render deployments](https://render.com/docs/deploys) and [health checks](https://render.com/docs/health-checks). Service and deployment observations came from the connected Render account; database comparisons came from the connected Tuljai-Stays Supabase project.
