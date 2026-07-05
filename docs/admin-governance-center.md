# Admin Governance Center

Module 05 Sequence 04 adds the admin governance foundation for lodges, owners, rooms, photos, and verification.

## Routes

- `/admin/lodges` lists lodges with status, verification, visibility, and inspection links.
- `/admin/lodges/:id` opens lodge governance detail with readiness checks, moderation actions, amenity assignment, room status controls, and photo review actions.
- `/admin/owners` assigns an existing owner user to a lodge.
- `/admin/rooms` manages lodge room status from one operations surface.
- `/admin/photos` reviews pending lodge photos.
- `/admin/verification` manages the lodge verification queue.

## Backend APIs Used

- `GET /api/lodges`
- `GET /api/lodges/:id`
- `PATCH /api/admin/lodges/:id/status`
- `PATCH /api/admin/lodges/:id/verify`
- `POST /api/admin/lodges/:lodgeId/owners`
- `GET /api/lodges/:lodgeId/room-types`
- `GET /api/owner/lodges/:lodgeId/rooms`
- `PATCH /api/owner/rooms/:id/status`
- `GET /api/admin/photos/pending`
- `GET /api/owner/lodges/:lodgeId/photos`
- `PATCH /api/admin/photos/:id/approve`
- `PATCH /api/admin/photos/:id/reject`
- `GET /api/amenities`
- `POST /api/admin/lodges/:lodgeId/amenities`

## Permissions

- `lodges.view` protects lodge list, lodge detail, and verification visibility.
- `lodges.manage` enables lodge status, verification, amenity, and owner assignment actions.
- `owners.view` protects owner governance.
- `owners.manage` enables owner assignment.
- `rooms.view` protects room governance.
- `rooms.manage` enables room status changes.
- `photos.review` enables pending photo review.

## Current Limitations

- Owner directory search is foundation-only because the backend does not yet expose `GET /api/admin/users?role=OWNER`.
- Owner assignment requires an existing owner user id.
- Room creation and room type editing remain in the owner/backend foundation and are not expanded in this sequence.
- Photo review uses the existing pending-photo API; all-lodge media search can be added when a paginated admin media endpoint exists.

## Next Recommended Phase

Module 05 Sequence 05 should build the admin owner directory and richer lodge data operations after adding safe admin user-search endpoints.
