# Pilgrim App Final Report

Module 03 completes the Pilgrim App foundation through release readiness hardening.

## Screens Implemented

- Splash and authenticated app shell
- Login and OTP verification
- Home
- Lodge discovery and search
- Lodge details
- Booking request
- My Bookings
- Booking details and QR pass
- Notifications
- Announcements
- Profile

## Features Implemented

- OTP authentication foundation with secure session restore
- Lodge discovery, filtering, details, and recently viewed persistence
- Availability check, booking lock, and booking request flow
- Booking lifecycle display
- Pilgrim-safe scannable QR pass with refresh and expiry handling
- Realtime booking status updates through Socket.IO foundation
- Push notification registration foundation
- Festival mode and public settings display
- Offline banner and safe fallback data for booking summaries
- Global crash fallback
- Deep link foundation
- Resilient image placeholders and fallback states

## API Endpoints Used

- `POST /api/auth/otp/request`
- `POST /api/auth/otp/verify`
- `GET /api/auth/me`
- `GET /api/lodges`
- `GET /api/lodges/:id`
- `GET /api/bookings/my`
- `GET /api/bookings/:id`
- `POST /api/bookings/availability`
- `POST /api/bookings/locks`
- `POST /api/bookings`
- `GET /api/bookings/:id/qr`
- `GET /api/notifications`
- `POST /api/notifications/device-tokens`
- `GET /api/announcements`
- `GET /api/settings/public`

## Offline Behavior

- Auth session is restored from secure storage.
- Recently viewed lodge IDs are persisted.
- Last known safe booking summaries are persisted.
- Notification prompt state is persisted.
- QR payloads are not intentionally persisted beyond current display state.
- Booking creation and QR refresh require an online server connection.

## Realtime Behavior

- The app subscribes to booking, QR, check-in, checkout, and announcement events.
- Relevant booking lists and details refresh when matching realtime events arrive.
- Realtime is used only for lifecycle updates, not normal CRUD.

## Push Notification Behavior

- Device token registration is prepared through the notification foundation.
- Booking and announcement notification flows can deep link into app screens.
- Expo Go should be treated as limited for production push validation.

## QR Behavior

- The app renders the backend-provided `qrPayload` as a scannable QR code.
- The QR payload is opaque, signed, short-lived, and excludes guest contact or ID details.
- Expired QR payloads show clear messaging and can be refreshed online.
- Owner scan verification remains server-owned through `POST /api/qr/scan`.

## Accessibility Improvements

- Key actions include screen reader labels and hints.
- QR pass shows human-readable instructions and expiry text.
- Image failures show accessible fallback placeholders.
- Status states use visible text.
- Form labels and validation messages remain visible.

## Deep Links

- `tuljaistays://lodges/:id`
- `tuljaistays://bookings/:id`
- `tuljaistays://bookings/:id/qr`
- `tuljaistays://announcements`
- Legacy scheme `tuljai-stays://` is also registered for internal compatibility.

## Known Limitations

- Production push behavior requires a real device and production credentials.
- Native date input should be revisited before Play Store release.
- Owner App and Admin Dashboard frontend flows are not implemented in Module 03.
- Offline booking is not supported.
- Payments, WhatsApp, settlements, reviews, and analytics are outside this module.
- Real lodge data is required for complete end-to-end validation.

## Test Checklist

Use `docs/pilgrim-app-release-checklist.md` for internal QA and release readiness testing.

## Build Status

- Typecheck: passed during Sequence 06 verification.
- Lint: passed during Sequence 06 verification.
- Build: passed during Sequence 06 verification.
- Format check: passed during Sequence 06 verification.

## Remaining Work Before Play Store

- Test on physical Android devices with production-like backend data.
- Replace placeholder app icon and splash artwork with final brand assets if required.
- Validate FCM delivery with release credentials.
- Validate privacy policy, store listing, and support contact details.
- Complete Owner App and Admin Dashboard flows needed for real operations.

## Recommended Next Module

Start Module 04 with the Lodge Owner App foundation and owner-facing booking management.
