# Owner App Release Checklist

This checklist is for controlled internal testing with real lodge owners before public release.

## Manual QA Journey

1. App opens with Tuljai Stays Owner branding.
2. Owner logs in using OTP.
3. Owner session restores after app restart.
4. Non-owner login is rejected safely.
5. Assigned lodge loads after login.
6. Multiple-lodge account is handled safely and does not show another lodge's data.
7. Dashboard loads summary cards.
8. Owner status changes between Available, Busy, and Offline.
9. Realtime connection status appears and reconnects after network interruption.
10. New booking alert appears while app is in foreground.
11. Accept booking works. Requires backend booking created by Pilgrim App or seed data.
12. Reject booking requires a reason.
13. Booking list updates after accept/reject.
14. QR scanner opens.
15. Camera permission denied state works.
16. Valid QR check-in works. Requires approved booking and active pilgrim QR pass.
17. Duplicate QR scan is handled with a clear used-QR message.
18. Expired QR scan is handled with a refresh instruction.
19. Wrong-lodge QR is rejected safely.
20. Guest register unlocks only after successful check-in.
21. ID verification works.
22. Owner notes save.
23. Checkout works.
24. Room status updates.
25. Room management creates room types/rooms and updates status.
26. Photo approval status displays. Admin approval/rejection requires backend/admin action.
27. Notifications list loads and mark-read actions work.
28. Announcements list loads and emergency/festival messages are prominent.
29. Register dashboard loads, filters, and opens register detail.
30. Reports load from owner report APIs.
31. Offline mode keeps safe cached reads and disables write actions.
32. Logout clears session and returns to login.

## Accessibility QA

- Check Login and Verify OTP with screen reader enabled.
- Confirm key buttons have readable labels and hints.
- Confirm all status chips use visible text, not color-only meaning.
- Increase system font size and verify dashboard, booking cards, scanner result, register, notifications, reports, and settings remain usable.
- Confirm Reception Mode scanner text remains high contrast.
- Confirm full-screen booking alert is readable on small Android screens.
- Confirm loading and error states use plain, actionable copy.

## Real Android Device Testing

- Camera permission prompt and denied state.
- QR scan focus and scanning speed in bright and low light.
- Vibration behavior for incoming booking alert.
- Foreground realtime booking alert behavior.
- Push notification permission and device-token behavior if owner FCM registration is enabled later.
- Slow network loading and retry behavior.
- Offline mode with airplane mode and unstable Wi-Fi.
- Battery saver mode and background network limitations.
- Small-screen layout around the scanner and full-screen booking alert.
- Large-screen/tablet layout for register dashboard and reports.
- Low-memory app restart and owner session restore.

Expo Go limitations:

- Push notification delivery and notification deep-link behavior may not fully match a production/dev build.
- Android full-screen incoming booking behavior may require a native dev build and full-screen intent setup.
- App icon, adaptive icon, splash, permissions, and package metadata need validation in a native build.

## Offline Audit

Allowed offline:

- View cached selected lodge.
- View cached dashboard summary.
- View cached room board.
- View cached register summary.
- View cached notifications.
- View local owner settings.

Disabled offline:

- Accept booking.
- Reject booking.
- QR scan validation.
- Checkout.
- Room status update.
- Room type update.
- Photo metadata submit.
- Notification read/delete.
- Announcement read.
- Reports refresh.

Required message for blocked write actions:

```text
Connect to the internet to complete this action.
```

Operational actions must not be queued offline.

## Production Environment Readiness

- `apps/owner-app/app.json` uses display name `Tuljai Stays Owner`.
- Deep-link scheme is `tuljaistays-owner`.
- Android package placeholder is `com.tuljaistays.owner`.
- iOS bundle identifier placeholder is `com.tuljaistays.owner`.
- Camera permission copy is configured for QR scanning.
- Android camera and vibration permissions are declared.
- `EXPO_PUBLIC_API_BASE_URL` must point to the Render backend URL for production.
- For LAN testing, set `EXPO_PUBLIC_API_BASE_URL` to the local network API URL reachable from the Android device.
- No owner app production code should hardcode localhost.

## Deep Link Smoke Tests

- `tuljaistays-owner://dashboard`
- `tuljaistays-owner://bookings`
- `tuljaistays-owner://bookings/:id`
- `tuljaistays-owner://scan`
- `tuljaistays-owner://register/:id`
- `tuljaistays-owner://notifications`
- `tuljaistays-owner://announcements`

Deep links are foundation routes through Expo Router. Push notification payload routing should be verified once owner push registration is enabled in a native/dev build.
