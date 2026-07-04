# Owner Dashboard, Booking Alerts, and Accept/Reject Flow

Module 04 Sequence 02 adds the first operational owner workflow.

## Dashboard Flow

- Owner dashboard loads assigned lodge data from the existing owner lodge foundation.
- Live summary data is loaded from `GET /api/owner/dashboard/summary`.
- The dashboard shows pending bookings, today's bookings, today's check-ins, today's check-outs, available rooms, occupied rooms, maintenance rooms, estimated revenue, estimated commission, average rating, and notification badge foundation.
- Pull-to-refresh reloads assigned lodge and summary data.
- If the summary cannot load while offline, the app shows the last cached dashboard summary when available.

## Owner Presence

- Owner status options are `AVAILABLE`, `BUSY`, and `OFFLINE`.
- Status changes are published through Socket.IO events:
  - `owner:status-update`
  - `presence:update`
- Status is local plus realtime in this sequence. Backend persistence for owner availability is not implemented yet.

## Realtime Events

The Owner App connects to the authenticated `/realtime` namespace when logged in and listens for:

- `booking:new`
- `owner:alert`
- `booking:accepted`
- `booking:rejected`
- `booking:expired`
- `room:availability-updated`
- `dashboard:update`
- `notification:new`
- `notification:unread-count`
- `announcement:new`

Realtime events trigger safe REST refreshes. REST remains the source of truth.

## Incoming Booking Alert

- Foreground `booking:new` or `owner:alert` events load the latest pending booking for the selected lodge.
- The app shows a full-screen alert with guest name, guest count, room type, dates, special request, and accept/reject actions.
- Vibration is used for a short local alert.
- The alert stops when the owner accepts, rejects, or closes the alert.
- Background or closed-app full-screen intent behavior is OS and FCM dependent and is not guaranteed in Expo Go.

## Booking List

- `GET /api/owner/bookings` is used with `lodgeId`, `status`, `page`, and `limit`.
- Filters are available for pending, accepted, checked-in, checked-out, rejected, and expired bookings.
- Pending booking cards expose accept, reject, and detail actions.

## Accept/Reject Workflow

- Accept calls `POST /api/owner/bookings/:id/accept`.
- Reject calls `POST /api/owner/bookings/:id/reject` with a required reason.
- Offline accept/reject is disabled because room availability must be server-validated.
- After a successful action, booking list and dashboard data refresh through the existing hooks and realtime events.

## Sensitive Data Visibility

Before QR check-in, the owner app shows only owner-safe booking data:

- booking code
- guest name
- guest count
- room type when returned by owner summary
- check-in and check-out dates
- special request
- owner response deadline
- status

The app does not show guest phone number, guest address, or government ID details before check-in.

## Known Limitations

- Owner status is not persisted by the backend yet.
- Background full-screen incoming call style alerts are not implemented.
- QR scanner, check-in, digital guest register, room management, photo upload, reports, and admin panel work are not part of this sequence.
- Dashboard unread notification count currently uses the recent notification list returned by the summary endpoint.

## Next Sequence Recommendation

Module 04 Sequence 03 should implement QR scanner, secure check-in, unlocked guest details, digital guest register, and checkout workflow.
