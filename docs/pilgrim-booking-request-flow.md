# Pilgrim Booking Request Flow

Module 03 Sequence 03 adds the pilgrim-side booking request flow on top of lodge discovery.

## Screens

```text
apps/pilgrim-app/app/(app)/
  lodges/
    [id].tsx
  bookings/
    index.tsx
    new.tsx
    [id].tsx
```

## Flow

1. A pilgrim opens a verified lodge detail page.
2. The app shows approved photos, lodge details, amenities, room type previews, location, rules, darshan helper copy, and emergency-contact foundation.
3. Opening the detail page saves the lodge ID to the local recently viewed foundation.
4. The pilgrim taps `Check Availability`.
5. The booking form collects check-in date, check-out date, adults, children, and room type.
6. The app calls availability before enabling booking continuation.
7. If available, the app creates a real backend booking lock and shows the lock expiry time.
8. The pilgrim enters guest details and optional special request.
9. The app submits the booking request and opens the booking status screen.
10. My Bookings lists the pilgrim's booking requests and read-only booking details.

## API Endpoints Used

- `GET /api/lodges/:id`
- `GET /api/lodges/:lodgeId/photos`
- `GET /api/lodges/:lodgeId/room-types`
- `GET /api/lodges/:lodgeId/room-types/:roomTypeId/availability`
- `POST /api/bookings/lock`
- `POST /api/bookings`
- `GET /api/bookings/my`
- `GET /api/bookings/:id`

## Booking Lock Behavior

- The frontend never fakes a room hold.
- `POST /api/bookings/lock` is called only after a successful availability response.
- The lock expiry returned by the backend is shown to the pilgrim.
- If the lock expires before final submission, the submit button is disabled and the pilgrim must re-check availability.

## Availability Behavior

- Check-in and check-out dates use `YYYY-MM-DD` inputs for this sequence to avoid adding a native date picker dependency.
- Check-out must be after check-in.
- Adults must be at least `1`.
- Guest counts must fit the selected room type capacity.
- If offline, availability checks and booking creation are disabled.

## Privacy Rules

- Lodge owner contact details are not displayed on the pilgrim lodge detail page.
- QR display is not implemented in this sequence.
- Contact details are collected only for booking creation and are handled by backend masking rules.
- Sensitive backend errors are converted to safe user-facing messages.

## Known Limitations

- Date inputs are text-based and should be upgraded to a native date picker in a later mobile polish pass.
- Recently viewed lodges are stored locally, but a full home UI section can be expanded later.
- Booking detail enriches lodge and room names through existing public lodge endpoints because booking responses currently return IDs.
- Payments, QR pass display, review submission, and notification center remain intentionally deferred.

## Next Sequence

Module 03 Sequence 04 should implement accepted-booking QR pass display, check-in readiness states, notification touchpoints, and booking lifecycle polish without introducing payments prematurely.
