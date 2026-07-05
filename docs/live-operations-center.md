# Enterprise Live Operations Center

## Scope

Module 05 Sequence 02 replaces the admin dashboard placeholder with a live operations command center. It focuses on monitoring, realtime refresh, intervention visibility, call-center foundation controls, QR health, notification health, festival pressure, and map foundation.

This sequence intentionally does not implement lodge CRUD, booking override workflows, owner verification, analytics, finance, settlement, remote configuration, or support-center case management.

## Realtime Architecture

The admin panel connects to the existing Socket.IO namespace:

```text
/realtime
```

Subscribed events:

- `booking:new`
- `booking:accepted`
- `booking:rejected`
- `booking:expired`
- `checkin:completed`
- `checkout:completed`
- `owner:status`
- `owner:status-update`
- `dashboard:update`
- `room:status`
- `room:status-updated`
- `notification:new`
- `announcement:new`
- `qr:generated`
- `qr:scanned`
- `qr:scan-success`
- `qr:scan-failed`

Realtime events debounce a REST refresh so the dashboard avoids duplicate network bursts. If the socket is disconnected, the dashboard falls back to periodic REST refresh every 45 seconds.

## REST APIs Used

- `GET /api/admin/dashboard/summary`
- `GET /api/admin/realtime/presence`
- `GET /api/admin/notifications/metrics`
- `GET /api/admin/bookings`
- `GET /api/lodges`
- `GET /api/owner/qr-scans`
- `GET /api/announcements`
- `GET /api/settings/public`

## Dashboard Widgets

Live KPI cards display available aggregate metrics for:

- Active pilgrims
- Active lodge owners
- Online owners
- Busy owners foundation
- Offline owners
- Pending bookings
- Bookings waiting for owner
- Admin intervention queue
- Today's bookings
- Today's check-ins
- Today's check-outs
- Rooms available
- Rooms occupied
- Rooms cleaning foundation
- Rooms maintenance foundation
- QR generated foundation
- QR scans
- Failed QR scans
- Notifications pending
- Failed notifications
- Emergency announcements

Each card includes an icon marker, current value, last updated time, live indicator, and future navigation action text.

## Owner Presence

The dashboard shows live aggregate owner presence from `GET /api/admin/realtime/presence`.

Detailed owner rows for owner name, assigned lodge, response time, pending bookings, status, and last seen require a future admin owner-presence endpoint. The UI documents this limitation instead of showing fake owners.

## Lodge Status Board

The lodge board uses public lodge records plus recent admin bookings to estimate pressure:

- Green: no pending pressure
- Yellow: pending bookings exist
- Red: high pending pressure
- Gray: suspended lodge

Room-level cleaning/maintenance counts per lodge require a future admin room-board endpoint.

## Admin Intervention Queue

The queue currently derives intervention items from:

- Bookings pending owner approval
- Expired bookings
- Recent failed QR scans

Prepared operator controls:

- Open Booking
- Call Owner
- Call Pilgrim
- Copy Phone
- Record Call Outcome
- Add Note
- Escalate
- Transfer

These are UI foundation controls only. No booking override, transfer, or support workflow is implemented yet.

## Call Center Foundation

No VoIP is implemented. The command center prepares call-center actions and internal workflow buttons for later integration with admin booking detail and support modules.

## QR Monitoring

QR monitoring displays recent scan volume and failure categories:

- Duplicate/used QR
- Expired QR
- Wrong lodge
- Invalid QR
- Failed validation

QR generated-today count requires a dedicated admin QR summary endpoint.

## Notification Health

Notification health uses `GET /api/admin/notifications/metrics` for sent, delivered, read, failed, and pending estimates. Retry queue details are reserved for a later notification operations sequence.

## Emergency Operations Banner

Emergency announcements from `GET /api/announcements?category=EMERGENCY` render as a full-width operations banner. Dismissal is not implemented because backend dismissal is not currently available.

## Festival Widget

The festival widget reads public settings and appears active only when `festival_mode` is enabled. It shows current occupancy estimate, booking pressure, and live pilgrim presence where available.

Average response time, estimated wait time, and today's total pilgrim footfall require future operations endpoints.

## Map Foundation

The map foundation renders lodge markers with pressure colors. It does not use a paid map provider and does not require clustering yet.

Coordinates exist on lodge details, but the current dashboard uses public lodge list data. A future admin lodge-map endpoint should return coordinates, owner, room counts, and pending booking counts in one optimized response.

## Known Limitations

- Detailed owner presence list endpoint is not available yet.
- Per-lodge room status counts are estimated or pending.
- QR generated-today count needs an admin QR summary endpoint.
- Admin intervention buttons do not perform override, transfer, escalation, or note writes yet.
- Emergency banner dismissal requires backend support.
- Global search is dashboard-local and routes to future pages later.
- Live map is a provider-free foundation, not a full geospatial map.

## Next Sequence

Module 05 Sequence 03 should implement admin booking operations: booking detail, intervention actions, owner/pilgrim contact workflow, internal notes, escalation, and safe admin override controls with audit logging.
