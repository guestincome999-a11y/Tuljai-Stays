# Pilgrim native redesign and booking QR

## Scope and audit

Implementation branch: `codex/pilgrim-premium-qr`, based on
`86360d78617b5e0f5ff5f35efca9d93650dde45c` (`fix/price-availability-sync`).
Implementation worktree: `D:\Tuljai-Stays-redesign`.
The original `D:\Tuljai-Stays` checkout contains pre-existing uncommitted
booking, payment recovery, catalogue, owner and admin work. Those changes are
preserved there and are not silently included in this PR. Reconcile that work
on the base branch before releasing a combined build.

The active Expo Router application uses `src/pilgrim-ui`, the existing auth,
connectivity, realtime and notification providers, and the existing booking API.
The repository also contains legacy feature screens and a v2 implementation;
these were audited but not replaced or made into a competing application.

The implementation followed audit, shared design tokens, screen changes,
existing QR integration, verification, then Git review. The supplied six-screen
showcase is the visual reference. Existing bundled Shri Tulja Bhavani artwork is
reused; accommodation photographs always come from backend records.

## UI and preserved behavior

- Splash and welcome: devotional artwork, Marathi identity, brand tagline and
  Get Started, with the original auth bootstrap, Google/OTP login and name setup.
- Home and browse: maroon/ivory/gold styling, notification count, Tuljapur location,
  admin-managed banners and festival updates, categories, real ratings/review
  counts and prices. Home requests six summaries; browse requests six records
  per page with server-side search, amenities, saved IDs, prices and sorting.
  Full room details remain lazy and simultaneous detail requests coalesce.
- Lodge detail: real gallery, review section, amenities, room names, occupancy,
  room prices and live date-specific availability. Unknown availability never
  substitutes total room capacity. Detail data and availability refresh on screen focus, foreground and pull-to-refresh.
- Checkout: existing three-step guest/ID/stay/payment forms, saved auth details,
  room photo and summary, server-returned online payment total, maroon Razorpay
  styling and Pay & Confirm Now. Amounts sent to Razorpay still come from the
  backend order. Both payment actions have synchronous double-tap guards.
- Confirmation: success is rendered only for a confirmed booking. Pay-at-lodge
  requests retain the pending state. Booking reference, stay and payment details,
  paid amount when supplied, QR access View Booking and Home navigation remain available.
- My Bookings: Upcoming, Completed and Cancelled tabs; actual lodge/room names,
  photo, dates, reference, booking/payment statuses, total and known paid amount.
  Eligible bookings link directly to their own QR. Profile editing, preferences,
  support, saved stays and logout remain intact.

`design-tokens.json` supplies app-scoped colours, spacing, radii, typography and native card shadows.
NativeWind and React Native Paper share these colours without changing the
owner/admin theme. Existing buttons, fields, cards, status badges, skeletons,
empty/error states, safe areas and navigation are reused and improved.
`StayImage`, `PaymentStatusBadge` and `DevotionalHero` are reusable additions.
Missing photographs render an image placeholder, not another lodge's stock photo.
Forms use keyboard avoidance and scrolling. Home, browse, bookings and QR support
pull-to-refresh. The replaced price-slider component was removed after verifying
it had no remaining imports; numeric range filtering remains available.

## QR and backend integration

The existing authorized `GET /catalog/my-bookings` also supplies real history photographs for lodges outside the initial public page.

The existing `GET /bookings/:id/qr` returns the server-signed
`tjsqr.v1` payload. The owner app already uses `POST /qr/scan`; it verifies the
signature, token identity/version, expiry, lodge authorization and booking
lifecycle, and consumes check-in tokens once. No second QR protocol, verification
endpoint, schema, database migration or production backend change was introduced.
The only backend-directory change is the existing booking-display regression test.

The QR payload contains booking identity/reference, opaque token ID, version,
expiry and signature; it does not contain guest contact data, documents or payment
credentials. The mobile app renders this exact payload and never generates its
own booking credential. An explicit missing, cancelled or expired booking cannot
fall back to another valid stay. Pending/failed payments, cancelled/refunded,
completed and already checked-in records do not offer another check-in credential.
The existing single-use policy takes precedence over displaying a QR for active
stays that have already checked in.

Download QR captures the pass as a 1440-pixel-wide PNG with preserved aspect ratio,
black/white QR contrast and a white quiet zone. It reauthorizes immediately before
exporting, validates payload identity/expiry, requests photo-only save permission,
saves through Expo MediaLibrary's SDK 57 legacy entry, and reports errors/success.
Expo Sharing opens the native image share sheet. Temporary captures are released.
The pass includes reference, lodge, room, dates and booking status. A saved image
never bypasses the owner's server-side verification.

The booking-contact endpoint is unchanged. Contact display is tied to the exact
booking, its eligibility and the server response; completed/cancelled/expired
records cannot reuse a previous booking's cached contact section. Confirmation
and QR routes do not expose public lodge phone numbers.

Existing booking creation, prepaid room holds, order preparation, backend payment
verification, retry handling, pay-at-lodge approval, notifications, reviews and
idempotency remain in their existing services. No amount, tax or example booking
fee was invented to match the reference. The current committed backend prices
these bookings at the room rate. No voucher PDF or calendar integration exists in
the active app, so no parallel voucher/calendar implementation was introduced.

## Verification

| Check                                       | Result  | Evidence                                                                                                                                                                                    |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pilgrim TypeScript                          | PASS    | `npm run typecheck --workspace @tuljai/pilgrim-app`                                                                                                                                         |
| Pilgrim ESLint                              | PASS    | `npm run lint --workspace @tuljai/pilgrim-app`                                                                                                                                              |
| QR policy/PNG/owner compatibility           | PASS    | `npm run test:booking-qr --workspace @tuljai/pilgrim-app`; six tests                                                                                                                        |
| Existing update policy                      | PASS    | `npm run test:updates --workspace @tuljai/pilgrim-app`; four tests                                                                                                                          |
| Booking display/catalogue regression        | PASS    | `node --test backend/scripts/booking-display.test.mjs`; seven tests                                                                                                                         |
| Live public API smoke                       | PASS    | `/health`, six-item catalogue page, lodge detail and selected-date availability returned HTTP 200; summary minimum and availability base rate matched room data                             |
| Expo public config                          | PASS    | `expo config --type public`                                                                                                                                                                 |
| Expo Android generation                     | PASS    | `expo prebuild --platform android --no-install`                                                                                                                                             |
| Production Hermes export                    | PASS    | `npm run build --workspace @tuljai/pilgrim-app`; Android Hermes bundle exported                                                                                                             |
| npm lock consistency                        | PASS    | `npm ci --dry-run --offline --ignore-scripts --no-audit --no-fund`                                                                                                                          |
| Expo latest-patch alignment                 | FAIL    | `expo install --check` flags existing SDK 57 patch drift and latest patch recommendations                                                                                                   |
| Android native release                      | PASS    | JDK 17 `gradlew.bat :app:assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a,x86_64`; final build successful in 7m 15s                                         |
| Actual native gallery download/share/decode | NOT RUN | Requires an eligible authenticated booking on a test environment                                                                                                                            |
| Real login, booking, payment and retry      | NOT RUN | User requested these checks remain untested; no sandbox account, charge or production booking                                                                                               |
| Native startup and small-screen auth layout | PASS    | Final release APK installed and launched on API 37 emulator at 360 x 640 dp; welcome, Get Started navigation, login scrolling, OTP/Google control visibility and keyboard dismissal checked |
| Six-screen authenticated device visual QA   | NOT RUN | No test account; authenticated lodge, checkout, confirmation, history and QR screens require follow-up device checks                                                                        |

QR tests use a synthetic booking and a test-only signing key to call the actual
backend signer/verifier and owner resolver. They encode with the same QR encoder
used by react-native-qrcode-svg, decode the PNG with jsQR, and assert the booking
reference, token and signature. This is not a claim that a gallery-saved native
screenshot or a real reception scan was tested.

The first Android build failed under JDK 25 in Worklets CMake with a restricted
Java method warning. It was retried using the repository-documented JDK 17 and
`--max-workers=2 -PreactNativeArchitectures=arm64-v8a,x86_64`.
The JDK 17 build succeeded. All 23 changed runtime TypeScript/TSX source files
match the final native bundle's source map. The local APK is debug-signed for
validation, not store distribution. The emulator reported offline despite healthy
host API access; its offline banner was checked and corrected for the safe area.
One System UI ANR occurred during the initial resource-constrained emulator boot;
subsequent final app startup produced no sampled AndroidRuntime or ReactNativeJS
errors. Emulator display overrides were restored after the small-screen checks.
Screenshots are local verification artifacts in `.codex-temp/screenshots/` and
are not production assets. No physical-device or iOS test was performed.
Dependency installation was slow; validation uses the existing local SDK 57
installation plus isolated test dependencies. TypeScript was also verified with the declared workspace version 6.0.3. The lockfile dry run succeeds.

## Release considerations

The Expo app version is `0.2.0`. With the existing `runtimeVersion: appVersion`
policy, this separates the native sharing-module change from older binaries.
Build a new native binary using the existing EAS profile; do not publish this
native-module addition as an update to a 0.1.0 binary. No OTA update, deployment,
store submission, production data write or main-branch merge is part of this PR.

Complete authenticated sandbox/device checks before calling the release fully
verified: Google/OTP, small-screen layouts, Marathi text, Android Back, room price
and availability edits, pay-at-lodge acceptance, Razorpay open/cancel/fail/pending/
success/retry, and downloading/sharing/decoding the native PNG. Review the existing
SDK patch-alignment warnings separately before distribution.
