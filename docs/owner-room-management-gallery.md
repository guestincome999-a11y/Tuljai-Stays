# Owner Room Management, Availability, Pricing, Gallery, and Housekeeping

Module 04 Sequence 04 adds the owner room operations workflow.

## Room Management

- Owners can view room type summaries and physical room boards for the selected lodge.
- Room data is loaded from:
  - `GET /api/lodges/:lodgeId/room-types`
  - `GET /api/owner/lodges/:lodgeId/rooms`
- Owners can add room types and physical rooms when online.
- Owners can activate or deactivate room types through `PATCH /api/owner/room-types/:id`.

## Room Status Rules

Room status changes use:

`PATCH /api/owner/rooms/:id/status`

Supported statuses:

- `AVAILABLE`
- `RESERVED`
- `PENDING_APPROVAL`
- `CONFIRMED`
- `OCCUPIED`
- `CLEANING`
- `MAINTENANCE`
- `BLOCKED`

The app warns before changing an occupied room. Backend permission and conflict handling remains the source of truth.

## Realtime Behavior

Room status updates publish:

- `room:status-updated`
- `room:availability-updated`

The Owner App listens for these events and refreshes the room board.

## Housekeeping Notes

There is no dedicated housekeeping notes table yet. Sequence 04 stores housekeeping notes locally on the owner device only.

These notes are not mixed with guest register notes and are not treated as a backend source of truth.

## Availability Calendar Foundation

The Availability tab shows:

- Room board by room number
- Current status counts
- Next seven days summary derived from current room statuses

Date-wise reservation overlays need future inventory APIs.

## Pricing Behavior

Room type forms support:

- Base price
- Festival price
- Capacity
- Total room count

Date-specific pricing is not available through owner APIs yet. Future work should add room pricing endpoints before enabling calendar-based price overrides.

## Gallery And Photo Approval

Owners can view all submitted lodge photos through:

`GET /api/owner/lodges/:lodgeId/photos`

Owners can submit photo metadata through:

`POST /api/owner/lodges/:lodgeId/photos`

Approval labels:

- `PENDING`: Waiting for admin approval
- `APPROVED`: Visible to pilgrims
- `REJECTED`: Rejected by admin

## Photo Upload Limitation

Supabase Storage foundation exists, but the Owner App does not yet include direct image picking, compression, or upload. Owners should submit metadata only after a storage URL exists.

The app does not fake uploads.

## Offline Behavior

When offline:

- Room board remains visible if already loaded.
- Room status changes are disabled by the API hook.
- Room type changes are disabled by the API hook.
- Photo metadata submission is disabled by the API hook.
- Updates are not queued offline.

## Next Sequence Recommendation

Module 04 Sequence 05 should focus on owner notifications polish, operational settings, and release readiness for the Owner App.
