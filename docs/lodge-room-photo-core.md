# Lodge, Room, and Photo Backend Core

Module 02 Sequence 02 adds the backend and database foundation for cities, lodges, lodge ownership, amenities, room inventory, room pricing and availability foundations, and lodge photo approval metadata.

This sequence does not implement bookings, QR workflows, payments, analytics, notifications, or frontend screens.

## Modules

| Module      | Purpose                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `cities`    | Stores enabled cities, starting with Tuljapur and supporting expansion. |
| `lodges`    | Manages lodge profiles, addresses, verification status, and visibility. |
| `owners`    | Assigns owner users to lodges and grants owner role access.             |
| `amenities` | Defines reusable amenities and assigns them to lodges.                  |
| `rooms`     | Manages room types and physical room inventory for owners.              |
| `photos`    | Stores uploaded photo metadata and supports admin approval.             |

## Database Summary

The Prisma schema now includes:

- `City`
- `Lodge`
- `LodgeAddress`
- `LodgeOwner`
- `LodgeDocument`
- `LodgeVerificationLog`
- `Amenity`
- `LodgeAmenity`
- `RoomType`
- `Room`
- `RoomPricing`
- `RoomAvailability`
- `LodgePhoto`

Supporting enums:

- `PropertyType`
- `LodgeStatus`
- `VerificationStatus`
- `LodgeDocumentType`
- `AmenityCategory`
- `RoomStatus`
- `PriceType`
- `PhotoCategory`
- `PhotoApprovalStatus`

## APIs

| Method  | Path                                      | Auth        | Purpose                                 |
| ------- | ----------------------------------------- | ----------- | --------------------------------------- |
| `GET`   | `/api/cities`                             | Public      | List active cities                      |
| `POST`  | `/api/admin/cities`                       | Admin       | Create city                             |
| `POST`  | `/api/admin/lodges`                       | Admin       | Create lodge                            |
| `GET`   | `/api/lodges`                             | Public      | List verified active lodges             |
| `GET`   | `/api/lodges/:id`                         | Public      | Get verified lodge details              |
| `PATCH` | `/api/admin/lodges/:id`                   | Admin       | Update lodge                            |
| `PATCH` | `/api/admin/lodges/:id/status`            | Admin       | Update lodge status                     |
| `PATCH` | `/api/admin/lodges/:id/verify`            | Admin       | Approve or reject lodge verification    |
| `POST`  | `/api/admin/lodges/:lodgeId/owners`       | Admin       | Assign owner user to lodge              |
| `GET`   | `/api/owner/lodges`                       | Owner/Admin | List lodges assigned to current owner   |
| `GET`   | `/api/amenities`                          | Public      | List active amenities                   |
| `POST`  | `/api/admin/amenities`                    | Admin       | Create amenity                          |
| `POST`  | `/api/admin/lodges/:lodgeId/amenities`    | Admin       | Assign amenities to lodge               |
| `POST`  | `/api/owner/lodges/:lodgeId/room-types`   | Owner/Admin | Create room type                        |
| `PATCH` | `/api/owner/room-types/:id`               | Owner/Admin | Update room type                        |
| `GET`   | `/api/lodges/:lodgeId/room-types`         | Public      | List public active room types           |
| `POST`  | `/api/owner/room-types/:roomTypeId/rooms` | Owner/Admin | Create physical room                    |
| `PATCH` | `/api/owner/rooms/:id`                    | Owner/Admin | Update physical room                    |
| `PATCH` | `/api/owner/rooms/:id/status`             | Owner/Admin | Update room status                      |
| `GET`   | `/api/owner/lodges/:lodgeId/rooms`        | Owner/Admin | List lodge rooms                        |
| `POST`  | `/api/owner/lodges/:lodgeId/photos`       | Owner/Admin | Create uploaded photo metadata          |
| `GET`   | `/api/admin/photos/pending`               | Admin       | List pending photos                     |
| `PATCH` | `/api/admin/photos/:id/approve`           | Admin       | Approve photo                           |
| `PATCH` | `/api/admin/photos/:id/reject`            | Admin       | Reject photo with reason                |
| `GET`   | `/api/lodges/:lodgeId/photos`             | Public      | List approved public photos for a lodge |

## Business Rules

- Public lodge results only include active, non-deleted lodges where `status` and `verificationStatus` are both `VERIFIED`.
- Owner APIs allow admins and super admins to manage every lodge.
- Owner users can manage only lodges where they have an active `LodgeOwner` assignment.
- Public room types only appear for verified active lodges and active room types.
- Public photo results only include non-deleted photos with `approvalStatus` set to `APPROVED`.
- Tuljapur is seed data, not hardcoded business logic. Future city expansion should use the `City` model and city slug filters.

## Photo Approval Workflow

1. Owner or admin uploads the file through the storage layer.
2. Owner or admin calls `POST /api/owner/lodges/:lodgeId/photos` with the uploaded file URL and metadata.
3. The photo is stored with `PENDING` approval status.
4. Admin reviews pending photos through `GET /api/admin/photos/pending`.
5. Admin approves or rejects the photo.
6. Only approved photos are returned by public lodge photo APIs.

## Seed Data

Run:

```bash
npm run db:seed
```

The seed creates or updates:

- Tuljapur city
- AC
- Non-AC
- Hot Water
- Parking
- Family Friendly
- CCTV
- Lift
- WiFi
- Restaurant
- Generator Backup

No fake lodges are seeded.

## Shared Types

`@tuljai/types` now exports shared city, lodge, room, amenity, and photo types so backend, mobile apps, and the admin panel can share contract-safe models as the next modules are added.

## Future Work

- Add lodge document upload and review endpoints.
- Add room pricing and room availability management endpoints.
- Add booking flow on top of verified lodges, room types, and room availability.
- Add owner mobile UI and admin lodge management UI.
- Add focused unit and integration tests for permissions and visibility rules.
