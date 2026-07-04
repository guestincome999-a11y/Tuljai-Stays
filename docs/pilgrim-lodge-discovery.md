# Pilgrim Lodge Discovery

Module 03 Sequence 02 adds the pilgrim-facing branded bootstrap, home screen, lodge discovery, search, filters, lodge cards, read-only lodge details, approved photo display, room type preview, pull-to-refresh, pagination foundation, and announcement preview.

## Screens

```text
apps/pilgrim-app/app/
  index.tsx
  (app)/
    home.tsx
    lodges/
      index.tsx
      [id].tsx
```

## Flow

1. The app boots through `app/index.tsx` with Tuljai Stays branding, Marathi welcome copy, helper text, and a lightweight pulse animation.
2. Authenticated pilgrims land on the home screen.
3. Home shows greeting, notification placeholder, search, quick filters, featured lodges, nearby lodges, and latest visible announcement when available.
4. Quick filters open lodge discovery with preselected filter state.
5. Lodge discovery lists verified active lodges only and supports search, property type, amenities, distance, price, and sort controls.
6. Lodge cards show approved cover photos only, verified status, distance, amenity preview, and starting room price.
7. Lodge details show approved photos, public lodge information, amenity chips, and room type price/capacity preview.

## API Endpoints Used

- `GET /api/lodges`
- `GET /api/lodges/:id`
- `GET /api/lodges/:lodgeId/photos`
- `GET /api/lodges/:lodgeId/room-types`
- `GET /api/amenities`
- `GET /api/cities`
- `GET /api/announcements`

## Offline Behavior

- The existing offline banner remains active.
- The discovery API layer keeps a light in-memory cache for lodge details, photos, room types, cities, and amenities during the app session.
- Pull-to-refresh and retry actions fail gracefully with user-facing messages.
- Booking and offline booking are intentionally not implemented in this sequence.

## Known Limitations

- Distance, price, amenity, and sort refinements are applied in the app on the currently fetched page when the backend does not expose those filters yet.
- Ratings are not displayed because the public lodge list does not yet expose aggregated review ratings.
- Notification bell is a visual placeholder with unread count `0`; notification UI is scheduled for a later sequence.
- Full room selection and booking creation are intentionally deferred to Module 03 Sequence 03.

## Next Sequence

Module 03 Sequence 03 should add lodge detail booking preparation, date selection, room type selection, availability checks, and booking request creation without exposing QR or payment flows prematurely.
