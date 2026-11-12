# Tuljai Stays performance and reliability engineering

Work started 7 November 2026 and continued through 9 November 2026 (Asia/Calcutta).

## Revised device target

On 8 November the user changed the minimum device target to 4 GB RAM and prioritized fast app loading. Tests below 4 GB are no longer required. The reported 0.5 GB figure was free physical memory on the Windows host, not the app/device allocation. The isolated test AVD was changed to 4 GB. It connected to ADB but did not finish Android initialization; installation failed before the package manager was ready, and window capture timed out under host memory pressure. It was shut down gracefully to finish source/build validation. No 4 GB app responsiveness claim is made.

## Status

The catalogue/performance pass and its Pilgrim release build passed. The final startup optimization passed both mobile type checks, targeted lint, all 19 Pilgrim tests, Owner Android export, and a second Pilgrim release build (8m 42s; 991 cached tasks). Background emulator launch and login-screen screenshot inspection passed; authenticated acceptance tests remain outstanding. This is not a claim of production rollout or certification on physical low-end phones. Android Studio and its emulator are installed; the clean 4 GB AVD now boots in background mode and runs the x86_64 release. Existing working-tree changes were preserved. No production data, credentials, schema, authorization, booking locks, or payment verification were changed by this task.

## Root cause: budget results depended on prior browsing

The active route is `apps/pilgrim-app/app/(app)/lodges/index.tsx`, which renders `PilgrimLodgesScreen`. It is distinct from the v2 `ExploreScreen` and the older feature-level `LodgeListScreen`; all three are still present.

In `src/pilgrim-ui/screens/PilgrimLodgesScreen.tsx`, the budget predicate required `lodge.hydrated !== false`. `backend-sync.ts::loadLodgeSummaries` deliberately creates cards with `hydrated: false`, even though the catalogue already supplies `startingPrice`, ratings and a cover URL. The screen then called `ensureLodgesHydrated` only for the **filtered** visible cards. A budget filter could therefore reject every summary, leave no IDs to hydrate, and remain empty. The home screen previously hydrated only its first four cards. Prior browsing and network completion therefore determined which prices were eligible for filtering.

This is a reproducible code defect explaining the device/history-dependent symptom. No request capture from the two reported physical phones was supplied, so their exact APK/OTA versions, network errors and session history have not been established. Do not represent the physical-device incident as closed until the same release is verified on both phones.

Additional defects found:

- The active screen displayed a numerical result count and an empty state while initial loading or a failed request was in progress. Catalogue loading/error state is now independent of private account refreshes.
- The 30-second catalogue poll could supersede a read lasting longer than 30 seconds on every tick. Polling now skips while a catalogue read is pending; explicit update events still invalidate stale generations.
- Production state was initially populated with the bundled demonstration lodge list, independently of the explicit mock flag.
- Legacy `searchLodgePreviews` filtered prices **after** paginating `/lodges`. Its per-lodge room request caught failures as `[]`, so a failed price lookup became a missing price and then a filtered-out lodge.
- v2 first-page caches had no expiry or size bound; obsolete requests were ignored but not cancelled, failed pagination was hidden, and same-tick end-of-list callbacks could request the same page twice.
- Catalogue price DTOs accepted integers only, despite decimal room prices.
- Concurrent catalogue cache misses each assembled the same catalogue, fetching unnecessary database fields.
- Uploaded photos used the full-size URL as their thumbnail URL.

## Implemented changes

### Pilgrim

- `lodge-price.ts` and shared `catalog-price.ts` use summary prices independently of detail hydration. Missing prices remain unknown rather than becoming free rooms. Bounds are inclusive, support decimals, and use numeric INR or ASCII decimal strings; formatted currency labels never become query values.
- Price slider bounds and sorting use valid summary prices. Summary amenity metadata is available before detail navigation.
- Replaced the active list's cumulatively growing ScrollView with FlatList: six initial items, six per render batch, five viewport windows, stable lodge IDs, and pull-to-refresh. Existing card styling and filter sheet remain.
- Home and listing cards render immediately from summaries. Full room details are requested on detail navigation. On the current six-lodge catalogue this removes four home detail calls and up to six listing detail calls from the path to usable cards.
- Real production lodge state starts empty, with loading/error/empty presentation, rather than showing demonstration records. Mock mode remains explicitly opt-in.
- A successful fresh summary updates displayed prices even for previously hydrated cards. A failed subsequent detail refresh retains that fresh summary rather than restoring an older price.
- Removed the artificial 2,200 ms minimum splash wait. Both mobile apps now restore a saved access token immediately when its expiry has more than 60 seconds remaining; expired/malformed/uncertain tokens retain the existing refresh flow. The shared expiry decoder does not require browser globals or a new package. This is only request scheduling: backend signature/session checks, the 180-day session deadline, Owner role gating and Pilgrim onboarding remain enforced. Recently used sessions avoid one startup network round trip; long-idle sessions still require refresh.
- Active cards use the already-installed `expo-image` disk cache and bounded layout. Listings retain thumbnails even after detail hydration; detail galleries use original photos. The horizontal gallery uses a FlatList with one initial image, one-image render batches and a three-viewport window instead of mounting all photos.
- Legacy discovery sends all filters to `/catalog/lodges` before pagination. Required price failures propagate as errors. Request revisions protect legacy and v2 state against old results; v2 also aborts obsolete requests and retry waits.
- v2 first-page cache: at most 20 entries, 15-second expiry, revalidation before showing a definitive zero count. Generic v2 cached fetch storage is bounded to 40 entries and ignores unmounted requests.
- Errors during pagination are visible with retry. Network interruptions/timeouts are distinguished from server failures. Retries are restricted to idempotent catalogue reads, not booking/payment writes.

### Owner

- Render the provider immediately while nonessential language settings load; failed settings reads no longer leave an unhandled rejection. A saved language can update after the shell first appears.
- Dashboard request revisions prevent stale responses from replacing newer dashboard data. Fallback polling pauses while the app is backgrounded. Existing realtime booking alerts, alert delivery and QR workflows are retained.
- Photo upload metadata uses the backend's optional generated thumbnail URL, with backward-compatible original-URL fallback.

### Admin

- Booking-list filter/page changes abort replaced reads and reject obsolete completions.
- Fallback booking polling skips hidden browser tabs. Existing live event handling and permissions remain.

### Backend and database

- Catalogue misses share one in-flight build per cache generation. Invalidating the cache prevents old builds from repopulating it, including an empty catalogue.
- Lodge/amenity, room-price and photo projections fetch fields actually consumed by catalogue mapping. Sorting uses ID tie-breakers so equal-price/rating rows paginate consistently.
- Decimal budgets are validated, missing/empty optional bounds are omitted, invalid currency strings reject, and reversed ranges return a request error.
- Public visibility still requires verified, active, non-deleted lodges; prices come from active room types with an available active room. Approved photo filtering remains.
- No new cache covers availability, booking creation, payment status, QR validation or settlements. Existing catalogue TTL remains 15 seconds; it is discovery data, not an authoritative dated booking quote.
- New photo uploads optionally generate an auto-oriented, metadata-stripped WebP within 640 × 480, without enlargement. One transform runs at a time; concurrent or failed derivatives fall back to the original. Input decoding is capped at 40 million pixels for the derivative. Original upload validation and permissions remain, and original paths are not migrated.
- `sharp@0.35.5` is declared directly and pinned for the backend. The initially installed transitive 0.34.5 version was rejected after the fresh audit identified image-library advisories. Its platform optional packages are represented in the lockfile. This adds backend deployment work, not a mobile native SDK.
- No schema or index migration was added or applied. Read-only inspection showed all 31 local Prisma migration names applied, with none reported rolled back. This checks history presence, not a full schema/checksum drift audit.

### Tooling

- Added catalogue contract/service, asynchronous hook and thumbnail tests to normal workspace test commands.
- Backend test files run with concurrency one to avoid multiplying ts-node/Prisma memory on this 8 GB development computer.
- Fixed Node test globals in ESLint and import ordering in an existing authentication test; no lint rules were disabled.

## Evidence and measurements

Do not equate structural reductions with measured device speedups.

| Metric | Before / deployed baseline | Changed implementation / measured result |
| --- | --- | --- |
| Artificial splash minimum | 2,200 ms | 0 ms artificial minimum; auth restoration still required |
| Fresh-token startup refresh calls | 1 blocking call | 0; covered by actual restoration callback tests |
| Home detail reads before cards are usable | Up to 4, in addition to catalogue | 0; summary cards render directly |
| Initial active listing detail reads | Up to 6 | 0; detail reads on navigation |
| Catalogue concurrent cold reads | One build per caller | 20 concurrent test callers share one build |
| v2 first-page retention | Unbounded, no expiry | 20 entries, 15 seconds |
| Thumbnail fixture | 2,812,148-byte existing PNG | 32,556-byte WebP, 349 × 480; original unchanged |
| Owner Android export | No comparable pre-change export captured | Hermes bundle approximately 5.4 MB; export succeeded |
| Pilgrim APK | No comparable release baseline captured | Release APK: 81,203,773 bytes (both ARM ABIs); Hermes bundle: 6,003,284 bytes |
| Cold/warm startup, content rendering, filter rendering | Not profiled on the reported phones | Pending signed-in testing of the new build |
| Idle/peak app memory and dropped frames | No comparable baseline | Not established; emulator host constraints affect results |

Read-only production API samples on 7 November (the local changes were **not deployed**):

| Query, page 1 / size 12 | HTTP | Elapsed | Body bytes | Total |
| --- | --- | --- | --- | --- |
| No budget | 200 | 3,425 ms | 3,871 | 6 |
| maxPrice=1200 | 200 | 340 ms | 2,610 | 4 |
| minPrice=500&maxPrice=1200 | 200 | 749 ms | 1,327 | 2 |
| maxPrice=0 | 200 | 311 ms | 65 | 0 |

These are single serial observations, not percentiles or an improvement claim. The first call includes connection/server warm-up effects. `backend/scripts/catalog-benchmark.mjs` can reproduce public read-only samples with an explicitly supplied `CATALOG_BENCHMARK_URL`.

A read-only production `EXPLAIN (ANALYZE, BUFFERS)` of the visible-lodge/city selection returned six rows in 3.052 ms execution time (35.634 ms planning). It used `lodges_deleted_at_idx` and `cities_slug_idx`, with no disk reads in that sample. This is one part of catalogue construction, not end-to-end API latency. It does not justify adding speculative catalogue indexes.

Supabase performance advisors reported 27 foreign keys without covering indexes and 84 unused indexes. Neither count alone justifies DDL or deleting indexes. Review workload frequency and query plans first: [foreign-key guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

APK composition is recorded in `performance-apk-analysis.json`: ARM64 native libraries contribute 23,044,040 bytes, 32-bit ARM libraries 15,964,568 bytes, resources 12,448,430 compressed bytes, and the Hermes bundle 6,003,284 bytes. This is a dual-ABI APK, not a Play-delivered per-device download size. R8/resource shrinking remains disabled in the existing local release configuration; enabling it requires separate SDK regression validation.

## Verification record

- Full workspace run: 128 passed, zero failed, two skipped (130 total across Admin, Owner, Pilgrim, Backend). A subsequent focused run passed all nine catalogue client tests, including three newly added tests executing the active provider callbacks for slow polling, latest-request loading/error state, and thumbnail/original separation during detail hydration.
- New catalogue and thumbnail tests cover numeric/string/decimal/missing/invalid prices, fresh versus hydrated summaries, multiple pages, zero results, visibility predicates, simultaneous misses, cache invalidation, slow/out-of-order completions, cancellation during requests/backoff, pagination failure, cached empty revalidation, image dimensions and concurrency.
- Existing regression suite covers authentication sessions, booking/payment idempotency and recovery, webhook raw bytes, QR check-in and cash collection. These tests do not substitute for live Razorpay or Google authentication testing.
- The two real PostgreSQL integration tests are skipped because `TEST_DATABASE_URL` was not supplied. They require a disposable test database; production was not substituted.
- Three added startup tests execute both real auth restoration callbacks and cover expiry margins, malformed tokens, runtimes without browser decoding globals, fresh-token request elimination, expired-token refresh, Owner role gating and Pilgrim onboarding.
- Prisma schema validation passed.
- Admin production build and shared packages passed after retrying outside the sandbox; the initial Next.js build had a generated-directory EPERM error. Backend build also completed after the thumbnail addition and Sharp update.
- Owner Android Hermes export passed after retrying outside the sandbox; initial export could not write its temporary bytecode file.
- Workspace TypeScript and ESLint completed successfully. The final provider polling guard and additional regression tests received a targeted lint recheck. Pilgrim native release build passed in 26m 57s, including release lint and signing validation (1,044 tasks).
- Dependency inventory before the direct image-processing declaration reported no invalid/missing package graph entries. The final full audit reported 65 advisories (5 low, 28 moderate, 30 high, 2 critical), superseding the package-install summary of 32; the backend uses patched Sharp 0.35.5, while the older root Sharp copy remains a Next.js transitive dependency. No force upgrade or dependency downgrade was applied.

## Android Studio compatibility testing

The installed AVD is `Medium_Phone_API_37.0`, x86_64 with ARM64 support, configured with 2 GB guest RAM. The host has approximately 8 GB physical RAM. The emulator itself warns that 16 GB host RAM is recommended, and Android System UI initially reported an ANR under concurrent build/test load. That is not evidence that Tuljai Stays caused an ANR.

The new APK could not update the existing app because Android reported `INSTALL_FAILED_UPDATE_INCOMPATIBLE` (different signing certificates). No uninstall or data wipe was performed. A separate `Tuljai_Performance_API37` AVD configuration reuses the installed system image and 2 GB hardware settings, leaving the original AVD and session intact. The clean AVD remains on the Android boot animation and ADB reports `offline`; installation cannot proceed yet. Windows reported only about 539,020 KB free physical RAM during this attempt. The user was asked to close unused applications voluntarily; no unrelated applications were closed by the agent.

The pre-existing installed Pilgrim app (versionName 0.2.0, versionCode 1) launched and reached sign-in. It is not the newly built artifact. An observed warm launch was 8,165 ms and sign-in PSS was 157,670 KB under host resource contention; these are diagnostic observations of the old install, not trustworthy before/after benchmarks.

No physical 2/3/4–6/8 GB phone, older supported Android image, or paired-device request trace has been tested. UI testing requires a signed-in session. The user reported signing in to the original install. Its signature mismatch prevents using that session in the newly signed build. A separate test account was authorized if needed, but no account was created and no authentication was bypassed. The computer-use guidance prohibits automating authentication, so the user was asked to sign in directly in the emulator, without sharing credentials in chat.

## Remaining work and release gates

1. Complete the new APK install and signed-in budget, retry, navigation and scroll checks in Android Studio. The release build passed. Confirm the embedded local bundle is running rather than an older OTA update.
2. Test both reported phones on the same APK/runtime/update ID. Record API base URL, selected bounds, page, HTTP status, request ID and totals; omit tokens and personal data.
3. Measure cold/warm startup, time to usable home/list, filter response/render, PSS/RSS and frame timing on actual representative devices. Repeat at least ten times after warm-up and report median/p95; do not advertise targets based on this emulator.
4. Exercise offline/reconnect, 2G/3G latency, timeout, rapid budget changes, background/foreground and repeated navigation with real authentication. Expect loading/error/retry rather than a false zero count.
5. Run the disposable PostgreSQL integration suites and staging booking, payment, webhook, owner alert, QR, privacy and role regression matrix. Preserve the intended 180-day session policy.
6. Validate new photo upload derivatives in staging. Older images remain originals until deliberately reuploaded or a separate backfill is approved. Saturated transforms intentionally fall back to originals.
7. The active provider still loads every catalogue page before completing its full snapshot and can refresh previously visited details. The current production catalogue has six lodges; large-catalogue server-driven discovery and bounded detail-refresh scheduling remain future measured work.
8. The legacy discovery compatibility path still hydrates preview details, and administrative text search currently filters the fetched page. These are retained limitations, not completed large-scale server-side search optimizations.
9. Review dependency security advisories separately with compatibility tests. Review large assets (2.81 MB splash, 2.13 MB owner artwork, several 1–1.6 MB icons/cutouts) before any visual-quality trade-off. No unverified asset or font removal was made.
10. Review the combined dirty working tree against `main` before creating a PR. Prior authentication, booking, payment, QR and owner redesign edits are not attributable to this performance task.

## Git and change scope

Current branch: `codex/owner-native-redesign`. Initial HEAD: `cdc912fb`. Local `main` was inspected; HEAD is 12 commits ahead and zero commits behind it, including the pilgrim UI/revert history; no branch reset, checkout replacement, merge or rebase was performed over existing edits. No commits, push or deployment were created. A reviewed PR against `main` is required after reconciling the existing work and completing release gates.

Task-specific source areas: `packages/utils/src/catalog-price.ts`, `access-token-freshness.ts` and exports; both mobile auth restoration paths; Pilgrim summary mapper/provider, active home/lodge/detail/auth screens and card image component; lodge-price helper; legacy discovery API/hook/empty UI; v2 catalogue request/list/cache/filter options and error UI; Owner dashboard hook/provider and upload API/metadata UI; Admin booking API/hook; backend catalogue service/DTO and photo controller/service/thumbnail helper; regression scripts, package test commands, ESLint Node globals and backend direct dependency/lockfile.

References used for image design: [Sharp resizing](https://sharp.pixelplumbing.com/api-resize/) and [Supabase image transformation availability](https://supabase.com/docs/guides/storage/serving/image-transformations). Supabase transformations require a suitable plan; the implemented upload derivative does not assume that feature is enabled.

## Final background emulator check (9 November)

The 4 GB AVD booted successfully with `-no-window -no-audio -no-boot-anim`. The final ARM APK installed successfully, but launch failed with `SoLoaderDSONotFoundError: libreactnative.so`; SoLoader searched x86_64 libraries while this APK contains ARM libraries. This is an emulator ABI mismatch, not a passing app launch. The phone artifact is preserved as `pilgrim-arm-release.apk`; an x86_64 test build is in progress. Authenticated filtering, frame timing and meaningful memory measurements are not yet verified.


## Final verified artifact and screenshot record

- ARM phone release: `apps/pilgrim-app/android/app/build/outputs/apk/release/pilgrim-arm-release.apk`, 81,203,773 bytes. This includes the final startup optimization.
- x86_64 emulator release: `apps/pilgrim-app/android/app/build/outputs/apk/release/app-release.apk`. Build passed in 7m 13s (1,032 tasks), installation passed, cold launch passed, and the app process remained alive.
- Background AVD: 4 GB guest RAM, API 37, no display window/audio/boot animation. An Android System UI ANR appeared during boot and was dismissed; it was not a Tuljai Stays ANR.
- Captured and viewed `docs/performance-screenshots/pilgrim-login.png`: branding, typography, form field, disabled OTP button, Google button and privacy text fit without visible clipping at 1080×2400. `pilgrim-current.png` records the system ANR overlay; `pilgrim-launch.png` records Android before app launch. These are not lodge-result screenshots.
- The language-toggle capture remained in English; Marathi switching was not verified and is not reported as passed.
- Cold-launch observation: Activity Manager TotalTime 6,406 ms / WaitTime 6,515 ms under host/system contention. A subsequent foreground intent returned in 29 ms; this is not a warm-start benchmark. No reliable before/after startup improvement percentage is claimed.
- Sign-in process sample: total PSS 154,671 KB, RSS 303,960 KB. This is not peak memory or signed-in scrolling memory.
- Final Pilgrim suite: 19 passed, zero failed. Earlier full workspace suite: 128 passed and two PostgreSQL tests skipped; six additional Pilgrim cases were added subsequently. Final startup utility build, both mobile type checks and targeted ESLint passed. Final Owner Android export passed. Git diff whitespace check passed with CRLF accounted for.
- No demo user was provisioned and no real OTP/payment was submitted. The separate emulator install has no signed-in session. Screenshots and manual checks of budget results, bookings, owner alerts and admin operations remain unexecuted. Automated filtering regressions passed; the reported two-phone incident remains pending same-release device verification.
- No commits, push, production deployment, credential changes or destructive database operations were performed.


## Installation compatibility correction — 9 November

The generic Gradle output was x86_64-only after emulator testing. Its former ARM copy was not durable: Gradle packaging cleared the output directory. The prior phone-APK link is superseded.

Correct distributable: `.codex-temp/apks/Tuljai-Stays-Android.apk` (105,998,571 bytes). SHA-256: `FDEE8371E82B38E923B8F71299482BC8E7C4D315C19F2B153E4C672935148A31`. SDK aapt confirms ARM64, 32-bit ARM and x86_64 native libraries; minimum Android API 24, target API 36. Build passed in 9m 23s. The exact distributable installed successfully on the 4 GB background emulator, launched and remained running (PID 3056 at inspection). This verifies the x86_64 path; physical ARM installation remains untested because no physical device is connected.

`docs/performance-screenshots/pilgrim-compatible-login.png` was captured from this exact build and visually inspected: no visible clipped text, overlapping controls or missing branding on the login screen. An Android System UI ANR appeared during emulator boot and was dismissed. The observed 10,485 ms Activity Manager startup is affected by that system contention and is not a phone performance benchmark.

Screenshots of authenticated home, lodge filters/details, favourites, checkout, bookings, passes, notifications and profile are not yet available: the isolated install has no authenticated session. No real phone number or OTP was supplied, no demo account was provisioned, and authentication was not bypassed. These screens are explicitly unverified. The existing original emulator data and prior working-tree changes were preserved.

## Premium design merged

The premium design from commit `c107028d` is now integrated with the current performance fixes. The new distributable is `.codex-temp/apks/Tuljai-Stays-Premium-Android.apk`, version 0.2.0 / build 43. See `premium-design-integration.md` for merge decisions, validation and inspected screenshots. Prior APKs do not contain this integrated release.
