# Owner native redesign — implementation and validation

## Investigation map

- npm monorepo: Expo Router owner/pilgrim apps, Next admin, Nest backend, shared types/UI/API client.
- Owner routes remain in `apps/owner-app/app`; feature screens own presentation, hooks own requests.
- Auth is email/password (`/auth/owner/login`), device-bound refresh, SecureStore, role gating and 401 session expiry. No owner Google sign-in exists.
- Dashboard summary is account-wide. `estimatedRevenue` is all booking value, not today's receipts. `totalIncome` and `commissionPayable` use the ledger. Do not relabel these as today's revenue.
- Bookings use paginated owner summaries, server date/payment/status filters, privacy-aware details, one room per booking, and `canOwnerRespond` for cash requests only. Prepaid assignment is automatic.
- Incoming alerts are mounted outside tabs. Push registration, OS categories, notification responses, realtime and foreground recovery remain in place.
- Room operations reuse existing room/type/photo/manual-block APIs. Pre-existing owner fixes scope room caches by user/lodge, use the owner room-type endpoint and protect against stale load responses. These related fixes are retained in this delivery.
- Date availability endpoint returns authoritative category counts; it does not identify individual future room availability. Show present physical status separately.
- Profile has account/lodge summary and links. No bank-edit or lodge-profile-edit owner workflow is implemented. Accounting is read-only; support/legal use existing contact/documents.
- Additional screens: QR scanner, guest register/ID verification/checkout, register dashboard, scan history, upcoming/history, reviews, announcements, notifications, reports, settings, password recovery. All retain their routes and actions.
- Existing UI primitives: Paper Card/Button/TextInput/Chip and owner Screen/Card/buttons. Extend these and use owner-scoped tokens; do not modify shared theme behavior.
- Owner scripts provide TypeScript and ESLint, but no component/integration test runner. Baseline owner typecheck and lint passed.

## Implementation plan

1. Owner-scoped Paper/NativeWind theme, system fonts, consistent cards and safe-area frame.
2. Four existing tab routes: Home, Bookings, Rooms, More; expose former tabs through quick actions/More.
3. Login branding, dashboard hierarchy and recent real bookings; retain presence, reception, finance, announcements and operational metrics.
4. Booking cards/list, incoming alert and date availability; preserve filters, pagination, response rules and privacy.
5. Profile/tools and all remaining owner screens use consistent tokens and navigation.
6. Run owner checks, Android bundling/config/native build where possible, emulator review; document limits without claiming unexecuted tests.

## Delivery constraints

The six-screen reference was supplied during implementation as `C:/Users/Admin/Downloads/Tuljai Stays Owner App Showcase.png`. It guides compact cards, four quick actions, white/cream surfaces, dark-maroon login/alert, and four-tab navigation. A temple-inspired login asset was generated using imagegen; it is an illustration, not documentary temple photography. Pre-existing owner room synchronization fixes are retained because they preserve the working owner behavior. Unrelated backend, pilgrim, admin and shared-type changes remain excluded. No backend/schema changes or new UI dependencies were introduced.

## Implemented design and reuse

The existing login, dashboard, incoming-alert host, booking list/cards/details, availability/room/type/gallery/amenity/manual-booking forms, profile, reports, reviews, notifications, reception/register/QR flows, settings and password recovery now share owner-only burgundy/cream tokens. Existing Paper controls, router, API client, hooks and validation remain the foundation. New modules are the owner theme and date-availability hook; the existing room/type forms now also support editing. No packages were added or removed.

Home uses real account summary values and selected-lodge room inventory. Estimated Revenue retains its all-date definition. Search filters loaded booking pages and is labelled accordingly; existing server filters and pagination remain available. Future availability uses category counts from the server; individual room badges retain current physical status.

Booking actions have immediate duplicate guards shared by UI and notification actions. Expired cash requests cannot expose response controls. Room mutations reload authoritative data through the existing hook; focus refreshes restore current inventory when returning from another owner workflow. Failed changes show errors in their open forms. The existing user/lodge cache scoping and stale-response guards are preserved in the delivered owner implementation.

Web review uncovered native-only notification calls and unstable fallback device identity. The web guard leaves Android/iOS notification listeners unchanged; native identity still uses SecureStore. The web fallback now persists its device ID in the existing session storage.

## Executed checks

- TypeScript and ESLint passed in the working app and an isolated worktree containing only staged redesign changes.
- Fourteen Node regression tests passed in both the working app and isolated verification worktree, covering booking eligibility/deadlines/payment labels, concurrent response actions and retries, exact availability contracts, mutation reload/failure/duplicate handling, stable web device identity, late-response protection and scoped cache isolation/corruption handling.
- Live API checks passed for login, assigned lodges, dashboard, paginated bookings/details, room inventory, category date availability, commission report, token refresh and logout. Unauthorized requests returned 401 and an unassigned lodge returned 403. Guest phone remained hidden before check-in. No live booking/status/payment mutations were performed.
- Android production JavaScript export and Expo config generation passed. Expo Doctor passed 20/21 checks; the existing SDK patch-version mismatches remain (including Expo 57.0.9 vs 57.0.31 and React Native 0.86.2 vs 0.86.3). The monorepo dependency stack was preserved.
- Local Android debug compilation passed: 476 tasks, installable x86_64 APK. An earlier EAS cloud attempt was blocked by the free Android build quota; the signed production build was completed locally instead.
- Browser review at 390×844 captured login, dashboard, bookings, rooms, profile, date picker and manual booking. Real authenticated data, navigation and full-page session restoration were checked. Native verification results are recorded below.

## Explicit functional limits

Google sign-in, a true today's-revenue endpoint, owner bank editing and owner lodge/account editing are not present in the existing implementation. This redesign preserves the existing email/password security and admin-managed permissions rather than inventing those capabilities. No backend/schema/authentication replacement was introduced. The incoming-alert rendering and background/closed-app push delivery still require a live eligible request and end-to-end device verification; unit tests are not evidence of push delivery.

## File inventory

52 files: 47 modified and 5 created. New files are the temple illustration, regression-test script, date-availability hook, owner theme and this report.

- `apps/owner-app/app.json`
- `apps/owner-app/app/(app)/_layout.tsx`
- `apps/owner-app/app/(auth)/_layout.tsx`
- `apps/owner-app/app/(auth)/forgot-password.tsx`
- `apps/owner-app/app/(auth)/login.tsx`
- `apps/owner-app/app/_layout.tsx`
- `apps/owner-app/assets/owner-temple-login.png`
- `apps/owner-app/package.json`
- `apps/owner-app/scripts/owner-ui.test.mjs`
- `apps/owner-app/src/components/FormErrorBanner.tsx`
- `apps/owner-app/src/components/OwnerSplashScreen.tsx`
- `apps/owner-app/src/components/error-boundary/OwnerErrorBoundary.tsx`
- `apps/owner-app/src/device/device-identity.ts`
- `apps/owner-app/src/features/announcements/screens/OwnerAnnouncementsScreen.tsx`
- `apps/owner-app/src/features/bookings/api/owner-bookings-api.ts`
- `apps/owner-app/src/features/bookings/components/DateRangeModal.tsx`
- `apps/owner-app/src/features/bookings/components/IncomingBookingAlert.tsx`
- `apps/owner-app/src/features/bookings/components/IncomingBookingAlertHost.tsx`
- `apps/owner-app/src/features/bookings/components/OwnerBookingCard.tsx`
- `apps/owner-app/src/features/bookings/components/RejectBookingModal.tsx`
- `apps/owner-app/src/features/bookings/hooks/useOwnerBookings.ts`
- `apps/owner-app/src/features/bookings/screens/OwnerBookingDetailScreen.tsx`
- `apps/owner-app/src/features/bookings/screens/OwnerBookingsScreen.tsx`
- `apps/owner-app/src/features/bookings/screens/PreviousBookingsScreen.tsx`
- `apps/owner-app/src/features/bookings/utils/booking-display.ts`
- `apps/owner-app/src/features/checkin/screens/CameraQrScannerScreen.tsx`
- `apps/owner-app/src/features/checkin/screens/GuestRegisterScreen.tsx`
- `apps/owner-app/src/features/checkin/screens/QrScannerScreen.tsx`
- `apps/owner-app/src/features/checkin/screens/ScanHistoryScreen.tsx`
- `apps/owner-app/src/features/dashboard/hooks/useOwnerDashboardSummary.ts`
- `apps/owner-app/src/features/dashboard/screens/DashboardScreen.tsx`
- `apps/owner-app/src/features/dashboard/screens/OperationalPlaceholderScreen.tsx`
- `apps/owner-app/src/features/notifications/screens/OwnerNotificationsScreen.tsx`
- `apps/owner-app/src/features/profile/screens/ProfileScreen.tsx`
- `apps/owner-app/src/features/register-dashboard/screens/RegisterDashboardScreen.tsx`
- `apps/owner-app/src/features/reports/screens/OwnerReportsScreen.tsx`
- `apps/owner-app/src/features/reviews/screens/OwnerReviewsScreen.tsx`
- `apps/owner-app/src/features/rooms/api/owner-rooms-api.ts`
- `apps/owner-app/src/features/rooms/hooks/useDateAvailability.ts`
- `apps/owner-app/src/features/rooms/hooks/useRoomOperations.ts`
- `apps/owner-app/src/features/rooms/screens/RoomManagementScreen.tsx`
- `apps/owner-app/src/features/rooms/storage/room-board-cache.ts`
- `apps/owner-app/src/features/settings/screens/OwnerSettingsScreen.tsx`
- `apps/owner-app/src/features/upcoming/screens/UpcomingStaysScreen.tsx`
- `apps/owner-app/src/notifications/OwnerPushNotifications.tsx`
- `apps/owner-app/src/owner-ui/components.tsx`
- `apps/owner-app/src/owner-ui/legal-documents.tsx`
- `apps/owner-app/src/owner-ui/theme.ts`
- `apps/owner-app/src/owner-ui/translations.ts`
- `apps/owner-app/src/types/expo-modules.d.ts`
- `apps/owner-app/tailwind.config.js`
- `docs/owner-native-redesign.md`

## Git isolation

Branch: `codex/owner-native-redesign`, based on the existing `fix/price-availability-sync` checkout at `86360d78`. The relevant owner room endpoint/cache fixes were already in the workspace and are retained, rather than shipping an older room implementation. Unrelated changes remain untouched and unstaged. No reset, discard, force push or remote overwrite is used. Normal review/merge into the intended mainline remains required.

## Production Android artifacts

The final local signed arm64-v8a AAB and APK completed successfully on 1 November 2026: `:app:bundleRelease :app:assembleRelease`, 805 tasks (52 executed, 753 up-to-date), 10 minutes 5 seconds. Native release lint, packaging and signing passed. Both archives contain the manifest, dex and arm64 native libraries, with no signing credentials included. `jarsigner -verify` passed for the AAB and `apksigner verify` passed for the APK. Both certificate fingerprints match the existing owner signing identity. The final production bundle's 113 owner source files were compared with the staged Git index: zero mismatches.

- Artifact: `D:/Tuljai-Owner-UI-Verify-20261030/apps/owner-app/android/app/build/outputs/bundle/release/app-release.aab`
- Size: 45,318,191 bytes; version code 18.
- SHA-256: `cad3d2f93a564cc3e383346e336103c387db778a18fc39f83b7ee9e5b960d8c8`.

- Artifact: `D:/Tuljai-Owner-UI-Verify-20261030/apps/owner-app/android/app/build/outputs/apk/release/app-release.apk`
- Size: 59,640,699 bytes; version code 18.
- SHA-256: `3bbe9144caa4664fdbd4985ca7443b84b96ccd83a27897b51688159ac6859ab3`.

The local build uses existing EAS signing credentials; all credential files and generated native/build output are ignored and excluded from the commit. Nothing was submitted to an app store. These local release artifacts target arm64; existing EAS build profiles remain unchanged. Native visual testing used the debug x86_64 APK, not the final signed release APK.

The debug APK installed successfully on the API 37 emulator. An emulator DNS failure caused a native network error during the initial authenticated attempt; restarting the emulator with an explicit DNS server restored backend hostname resolution.

## Native visual and workflow review

The actual existing owner app was installed as a debug APK on the API 37 Android emulator. Authenticated review used a user-approved demo owner with real backend data. Screenshots are retained locally under `.codex-temp/owner-redesign/screenshots` and are excluded from Git.

Reviewed and captured: login, dashboard, bookings, loaded-page search, booking details, room availability, date selector, room editing, manual booking, profile and financial reports. Native search returned four matches from 13 loaded records. Booking details kept contact and ID information hidden before check-in. Selecting 1–2 November refreshed authoritative category availability (3 deluxe and 5 standard rooms). Edit forms loaded the actual room number/floor. Manual booking required fields prevented submission; no production booking or room mutation was made.

Native review found and corrected three presentation issues: quick-action callback styling/column sizing, seventh calendar-column wrapping from percentage rounding, and keyboard overlap in the shared room/manual form container. Forms now resize and scroll on Android; visible field labels also have explicit screen-reader labels. Dashboard location uses the existing lodge-details API. The native notification permission prompt was exercised; an existing custom-sound warning falls back to the system default in the installed native implementation. Audible sound/vibration and push delivery are not thereby verified.

The emulator required an explicit DNS server and occasionally displayed a System UI startup freeze. These environment issues were recorded separately from app rendering. Final source checks and the production rebuild include the native QA refinements and retained owner synchronization fixes.

Final native checks also covered 411×914 and 360×640 dp layouts, legal navigation and scrollable content. After network startup, a force-stop/restart restored the authenticated session. Logout returned to the login screen with its email field cleared. Temporary emulator display overrides were restored and the emulator/local development servers were stopped after review.

## Final verification summary

| Check | Result |
|---|---|
| TypeScript | Pass, including isolated staged source |
| ESLint | Pass, including isolated staged source |
| Unit tests | Pass, 14 regression tests |
| Integration tests | Live read/auth API checks passed; full mutation/push integration suite not run |
| Android build | Pass, signed local arm64 AAB and APK |
| Visual verification | Pass for reviewed native/browser screens; incoming alert requires live event |
| Git diff review | Pass, owner app and report only; no secrets or build outputs staged |
| Expo Doctor | 20/21; pre-existing SDK patch mismatches remain |

Remaining device coverage: eligible incoming cash alert, actual accept/reject, live room/manual-booking writes, foreground/background/closed-app push, sound/vibration, physical camera/QR check-in and TalkBack. No matching pending cash request was available for the incoming-alert screenshot. No production booking or inventory was changed for testing. The app retains these existing workflows, but this report does not certify their unexecuted end-to-end behavior.
