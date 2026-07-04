# Pilgrim App Release Checklist

This checklist validates the Module 03 Pilgrim App against a real backend before internal testing.

## Environment

- Set `EXPO_PUBLIC_API_BASE_URL` for the target backend.
- Use `http://localhost:4000` for iOS simulator local testing.
- Use `http://10.0.2.2:4000` for Android emulator local testing.
- Use `http://<LAN-IP>:4000` for physical device testing on the same network.
- Use the Render HTTPS API URL for production-like testing.

## Manual Journey Checklist

- App opens with Tuljai Stays branding and no startup crash.
- OTP login request accepts a valid phone number and shows validation for invalid input.
- OTP verification completes and restores the session after app restart.
- Home loads featured lodges, nearby lodges, announcements, festival mode state, and notification prompt state.
- Search opens lodge results and supports quick filters.
- Lodge details open from cards and deep links, with gallery fallback when photos fail.
- Availability check validates dates and guest counts.
- Booking lock is created and expiry messaging is visible.
- Booking request is submitted only after a valid lock.
- My Bookings shows latest booking status and safe cached summaries when offline.
- Backend or owner flow accepts the booking; the pilgrim app refreshes status.
- QR pass appears only for accepted or QR-generated bookings.
- QR pass renders a scannable QR code, shows expiry, and supports refresh.
- Backend or owner QR scan moves booking to checked-in state; app updates after refresh or realtime event.
- Checkout state appears after backend checkout.
- Notifications list opens, marks reads, and shows empty/error/loading states.
- Announcements list opens from home and deep link.
- Offline mode shows clear messaging and does not allow offline booking or QR refresh.
- Logout clears the authenticated app session.

## Deep Links

- `tuljaistays://lodges/<lodgeId>` opens lodge details.
- `tuljaistays://bookings/<bookingId>` opens booking details.
- `tuljaistays://bookings/<bookingId>/qr` opens the booking details QR route.
- `tuljaistays://announcements` opens announcements.
- Legacy scheme `tuljai-stays://` remains registered during internal testing.

## Accessibility

- Screen reader labels are present for key buttons and image placeholders.
- Status badges include readable text, not color-only meaning.
- Forms show visible labels and validation messages.
- QR pass includes text instructions and expiry text.
- Dynamic text scaling keeps primary actions usable.
- Touch targets remain comfortable on small devices.

## Performance

- Lodge and booking cards are memoized.
- Lists use stable keys.
- Listing screens avoid loading full photo galleries.
- Refresh actions do not trigger duplicate permanent requests.
- Cached booking summaries are used only as a safe fallback.

## Crash Fallback

- Trigger a development render error and confirm the friendly fallback appears.
- Confirm stack traces are not shown to users.
- Confirm retry re-renders the app tree.

## Known Limitations During QA

- Expo Go may not fully validate production push notification behavior.
- Native date input may need platform-specific polish before Play Store release.
- Owner/Admin frontend flows are not part of Module 03.
- Offline booking is intentionally unsupported.
- Payment and settlement flows are intentionally unsupported.
