# Pilgrim Live Updates, FCM, QR Refresh, Festival Mode, and UX Polish

Module 03 Sequence 05 adds live-update foundations and mobile polish for the Pilgrim App.

## Push Notifications

The app includes a gentle permission card:

```text
Get booking updates instantly
Allow notifications so we can tell you when your booking is accepted, QR is ready, or checkout time is near.
```

Implementation:

- Uses `expo-notifications` to request permission.
- Uses Expo push token retrieval as the current Expo-compatible token foundation.
- Registers the token with `POST /api/auth/device-token`.
- Stores whether the prompt was shown so it does not repeat.
- Does not block app usage if permission is denied or unavailable.

Expo limitation:

- Real FCM behavior may require an Expo development build or production build.
- Expo Go may not provide full native push behavior.

## Socket.IO Live Updates

The app connects to the backend `/realtime` namespace with the authenticated JWT.

Handled events:

- `notification:new`
- `notification:unread-count`
- `booking:accepted`
- `booking:rejected`
- `booking:expired`
- `qr:generated`
- `checkin:completed`
- `checkout:completed`
- `announcement:new`

Live events trigger safe refreshes for:

- My Bookings
- Booking detail
- QR pass
- Notifications
- Announcements
- Home notification badge

REST refresh remains the fallback.

## QR Auto-Refresh

QR pass now shows:

- Real scannable QR from `qrPayload`
- Expiry countdown
- Manual `Refresh QR`
- Auto-refresh when the QR is close to expiry and the device is online
- Expired/offline-safe messaging

The raw QR payload is never displayed as text.

## Festival Mode

The app reads public settings from:

```text
GET /api/settings/public
```

Festival UI is disabled by default and appears only when the public settings enable it. No festival dates are hardcoded.

## Maps and Reminders

- Booking detail opens Google Maps using safe lodge address/name data.
- Accepted and QR-ready bookings show check-in readiness guidance.
- Bookings within the check-in window show a stronger reminder card.

## Remaining Work

Module 03 Sequence 06 should focus on release readiness, deeper offline persistence, final QA, accessibility pass, production build configuration, and any remaining lifecycle edge cases.
