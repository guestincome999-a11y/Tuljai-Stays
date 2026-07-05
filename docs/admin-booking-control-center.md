# Admin Booking Control Center

## Scope

Module 05 Sequence 03 adds the Admin Booking Control Center, booking detail view, manual operations foundation, call workflow, intervention queue, notes/escalation foundation, transfer foundation, and override controls.

This sequence does not implement lodge CRUD, owner verification, remote configuration, monitoring center, advanced analytics, finance, payment settlement, WhatsApp delivery, or support ticket center.

## Routes

- `/admin/bookings`
- `/admin/bookings/:id`
- `/admin/operations/intervention`

## Permissions

- `bookings.view`: view booking list/detail.
- `bookings.manage`: use normal manual booking status actions.
- `bookings.override`: see restricted override controls.
- `support.manage`: call workflow and note foundation access.
- `audit_logs.view`: reserved for future full audit feed visibility.

Read-only users see masked sensitive guest contact data.

## APIs Used

- `GET /api/admin/bookings`
- `GET /api/bookings/:id`
- `PATCH /api/admin/bookings/:id/status`
- `GET /api/owner/qr-scans`

Manual status updates use the existing backend admin status endpoint. Backend validation is not bypassed. Successful updates create booking history and audit logs through existing backend services.

## Booking List

The booking list includes:

- Status/date filters
- Local page-level search for booking code, guest, phone, lodge, room, and status
- Pagination
- Booking code
- Guest
- Lodge
- Room type
- Stay dates
- Status
- Owner response timer
- Waiting time
- Intervention priority
- Actions

The backend currently supports status, city, lodge, and date-range filters. Owner, booking code, guest, phone, intervention priority, owner response status, and QR status are prepared in the UI and should be moved server-side when larger data volumes require it.

## Booking Detail

The detail page shows:

- Booking code and status
- Payment status
- Lodge/room identifiers
- Guest name and contact privacy
- Check-in/check-out
- Guest count
- Special request
- Owner response deadline
- Created/updated timestamps
- QR/check-in/checkout state
- Intervention priority

Sensitive guest contact and address are masked unless the admin has manage/support/override permission.

## Timeline

The timeline is derived from available booking fields:

- Booking created
- Owner response deadline
- Booking accepted/rejected/expired where inferable
- Check-in completed
- Checkout completed

Full booking history, admin actions, call outcomes, notes, notification events, QR events, and audit logs require future admin history/audit endpoints.

## Intervention Priority Logic

- Critical: expired booking, same-day check-in issue, owner wait over 45 minutes, QR failures.
- High: pending booking over 20 minutes.
- Medium: normal pending booking.
- Normal: no action required.

The intervention queue combines priority bookings with failed QR scan logs.

## Owner Response Timer

Pending bookings show time remaining or overdue state. Overdue bookings display:

```text
Owner response overdue. Admin action recommended.
```

## Call Workflow

The workflow uses phone links only:

- Call Owner
- Call Pilgrim
- Copy Owner Number foundation
- Copy Pilgrim Number foundation
- Record call outcome foundation

No VoIP is implemented.

## Internal Notes

The note UI supports category, visibility, and private note content. Notes are not persisted yet.

Required future APIs:

- `POST /api/admin/bookings/:id/notes`
- `GET /api/admin/bookings/:id/notes`

Notes must remain admin-only unless a later module explicitly designs owner/pilgrim visibility.

## Escalation

The escalation UI supports reason and level selection. Escalations are not persisted yet.

Required future APIs:

- `POST /api/admin/bookings/:id/escalate`
- `PATCH /api/admin/bookings/:id/escalation`

## Manual Accept / Reject

Manual status updates are implemented through:

- `PATCH /api/admin/bookings/:id/status`

Rules:

- Reason is required.
- Confirmation is required.
- Backend validation is respected.
- Successful updates create booking history/audit entries.
- Force actions remain restricted to `bookings.override` and disabled when backend support is missing.

## Transfer Foundation

The detail page prepares transfer/reassignment recommendations:

- Nearest lodge
- Lowest price
- Highest rating
- Bhakt Niwas
- Budget option
- Same capacity

Required future APIs:

- `GET /api/admin/bookings/:id/transfer-options`
- `POST /api/admin/bookings/:id/transfer`

Transfer must require target lodge, target room type, reason, and notification choices.

## Override Controls

Override controls are only visible/useful to `bookings.override` users and are disabled until backend support exists.

Future controls:

- Force accept
- Force reject
- Mark expired
- Mark cancelled
- Reassign lodge
- Change room
- Regenerate QR
- Mark no-show

Every override must require a reason, confirmation, and audit log.

## Known Limitations

- Admin notes and escalation persistence need backend endpoints.
- Transfer is UI foundation only.
- Owner phone is not exposed in the admin booking list endpoint yet.
- Full audit feed is limited until an admin audit endpoint exists.
- Call workflow uses phone links, not VoIP.
- Some advanced filters are page-local until server-side query support is added.

## Next Sequence

Module 05 Sequence 04 should focus on lodge, owner, room, and photo governance for admins, including approval/rejection workflows and audit-safe moderation.
