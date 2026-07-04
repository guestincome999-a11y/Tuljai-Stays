# Pilgrim QR, Booking Lifecycle, Notifications, and Profile Polish

Module 03 Sequence 04 adds pilgrim-side booking lifecycle polish, QR pass readiness display, notification and announcement touchpoints, booking filters, and profile support sections.

## Screens

```text
apps/pilgrim-app/app/(app)/
  bookings/
    index.tsx
    [id].tsx
  notifications.tsx
  announcements.tsx
  profile.tsx
```

## Booking Lifecycle UI

Booking detail now shows a lifecycle timeline:

```text
Booking Requested
Owner Accepted
QR Ready
Checked In
Checked Out
Completed
```

Terminal statuses are shown safely:

- Rejected
- Cancelled
- Expired
- No Show

## QR Pass Behavior

- The app calls `GET /api/bookings/:id/qr` for accepted or QR-generated bookings.
- If an active QR display payload is returned, the booking detail renders a scannable QR, booking summary, guest name, and expiry.
- The backend stores QR token hashes internally and returns a short-lived signed payload for display.
- The app does not display the raw QR payload as text.
- Refresh is disabled while offline.

## QR Payload Security Model

The pilgrim QR payload is an opaque signed envelope:

```text
tjsqr.v1.<base64url-body>.<hmac-signature>
```

The body contains only safe references:

- `bookingId`
- `bookingCode`
- `qrTokenId`
- `expiresAt`
- `tokenVersion`
- `version`

It excludes guest phone number, address, government ID details, owner details, token hash, and database secrets. The owner scan flow posts the scanned payload to `POST /api/qr/scan`; the backend verifies the signature, token reference, active status, expiry, usage state, booking status, and lodge access before check-in.

## Notifications

Implemented touchpoints:

- Home bell uses `GET /api/notifications/unread-count`.
- Notification list uses `GET /api/notifications`.
- Read actions use `POST /api/notifications/:id/read`.
- Mark all read uses `POST /api/notifications/read-all`.

Push permission prompts and FCM registration remain deferred.

## Announcements

Implemented:

- Announcement list uses `GET /api/announcements`.
- Read action uses `POST /api/announcements/:id/read`.
- Emergency and festival announcements use stronger visual emphasis.

## Profile and Help

Profile now shows:

- User name or phone
- Role
- App version
- Support/help copy
- Terms/privacy placeholder
- Clear cached lodge history
- Logout

## Offline Behavior

- The global offline banner remains active.
- Booking detail and list can show already loaded in-memory data.
- QR refresh and backend actions are disabled or fail safely when offline.
- Users are asked to reconnect before check-in if QR readiness is uncertain.

## Known Limitations

- Notification and announcement lists are foundational and do not include push registration or Socket.IO live updates yet.
- Cached booking persistence is in-memory for this sequence.

## Next Sequence

Module 03 Sequence 05 should add FCM registration, deeper real-time Socket.IO booking updates, push notification permission handling, and live badge/status refresh.
