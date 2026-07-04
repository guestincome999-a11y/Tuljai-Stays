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
- If active QR metadata is returned, the booking detail shows QR-ready state, booking summary, guest name, and expiry.
- The current backend endpoint returns QR metadata only and does not expose the raw QR token because tokens are stored as hashes.
- The app does not fake a scannable QR and does not display raw token text.
- Refresh is disabled while offline.

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

- The QR pass cannot render a valid scannable QR until the backend exposes a pilgrim-safe QR payload or another secure handoff mechanism.
- Notification and announcement lists are foundational and do not include push registration or Socket.IO live updates yet.
- Cached booking persistence is in-memory for this sequence.

## Next Sequence

Module 03 Sequence 05 should add FCM registration, deeper real-time Socket.IO booking updates, push notification permission handling, and live badge/status refresh.
