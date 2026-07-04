# Owner QR Check-in, Guest Register, and Checkout Workflow

Module 04 Sequence 03 adds the owner reception workflow.

## QR Scanning Flow

- Owner opens the Scan QR tab.
- Camera permission is requested before scanning.
- The scanner accepts QR codes only.
- The owner app sends the scanned `qrPayload` to `POST /api/qr/scan` with the stable owner device ID.
- The app never validates QR locally and never stores the QR payload.
- Backend validation remains the source of truth.

## Duplicate Scan Protection

- Scanner locks while a QR is being processed.
- Repeated scans for the same payload are ignored until the owner resets the scanner.
- Successful scans show check-in details and actions to open the register or scan the next guest.
- Failed scans show a retry action.

## Reception Mode

- Reception Mode is a local owner preference.
- It increases scanner focus and scan frame size for high-rush reception use.
- The preference is stored locally with secure storage.
- No QR payload or sensitive guest document data is stored with this preference.

## Guest Register

- Successful QR validation creates or updates the backend guest register.
- The owner can open the register from the scan result.
- Register details include unlocked guest contact details, address, room, guest count, check-in time, expected checkout, owner notes, and ID verification state.
- Sensitive guest details are shown only after backend check-in validation succeeds.

## ID Verification

- Owner can mark ID as verified.
- Supported document types follow the backend `GuestIdType` enum.
- Verification calls `PATCH /api/owner/register/:id/id-verified`.

## Owner Notes

- Owner can add reception notes such as late arrival, extra mattress, VIP guest, or cleaning request.
- Notes are saved with `PATCH /api/owner/register/:id/notes`.

## Checkout Workflow

- Checkout calls `POST /api/owner/register/:id/checkout`.
- Backend updates booking status, register status, room availability, history, and notifications.
- Owner app shows a confirmation before checkout.

## Scan History

- Owner scan history uses backend QR scan logs through `GET /api/owner/qr-scans`.
- The app supports Today, This Week, Success, and Failed filters.
- History shows time, booking code, guest name when available, and scan result.

## Dashboard Reception Snapshot

- Dashboard now includes reception cards for today's check-ins, today's check-outs, and upcoming check-outs.
- Data is loaded from owner register APIs.
- Realtime booking, check-in, checkout, room, and dashboard events trigger refreshes.

## Offline Behavior

- QR scanning is disabled while offline because validation must happen on the server.
- Already-loaded register screens can remain visible.
- Check-in, ID verification, notes, and checkout require internet.

## Security Model

- QR payload is opaque and server-verifiable.
- Owner app never logs or stores QR payloads.
- Guest phone, address, and ID details are revealed only after successful QR check-in.
- Scan history is owner-scoped by backend lodge access checks.
- Backend remains responsible for owner-lodge authorization.

## Known Limitations

- Full background full-screen QR alert behavior is OS and notification-provider dependent.
- Gallery QR import is intentionally not implemented.
- Room management, gallery management, pricing, reports, analytics, and admin dashboard are outside this sequence.

## Next Sequence Recommendation

Module 04 Sequence 04 should implement owner room availability management, room status changes, and room-level operational controls.
