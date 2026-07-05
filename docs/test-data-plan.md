# Test Data Plan

## Users and Roles

| Data               | Purpose                        | Notes                              |
| ------------------ | ------------------------------ | ---------------------------------- |
| Super Admin        | Full admin access              | Backend role `SUPER_ADMIN`         |
| Admin              | Standard operations access     | Backend role `ADMIN`               |
| Operations Manager | Admin panel persona            | Validate operational route access  |
| Support Executive  | Admin panel persona            | Validate support-limited access    |
| Photo Reviewer     | Admin panel persona            | Validate photo governance access   |
| Finance Admin      | Admin panel persona            | Validate finance and export access |
| Analyst            | Admin panel persona            | Validate read-only BI access       |
| Pilgrim user       | Booking and QR tests           | Test phone only                    |
| Owner user         | Owner app and lodge management | Associated with verified lodge     |

## Lodging Data

| Data                          | Purpose                                             |
| ----------------------------- | --------------------------------------------------- |
| Verified lodge                | Public discovery and booking                        |
| Unverified lodge              | Admin verification and hidden public listing checks |
| Suspended lodge               | Access and visibility restrictions                  |
| Lodge with no rooms           | Empty state and booking prevention                  |
| Lodge with no approved photos | Public photo empty state                            |
| Room types                    | Availability and booking tests                      |
| Rooms                         | Occupancy, QR, register, checkout                   |

## Booking Data

| Data                 | Purpose                                    |
| -------------------- | ------------------------------------------ |
| Pending booking      | Owner accept/reject and admin intervention |
| Accepted booking     | QR generation eligibility                  |
| QR-generated booking | Pilgrim QR pass and owner scan             |
| Checked-in booking   | Register and occupancy state               |
| Checked-out booking  | Checkout and room status validation        |
| Rejected booking     | Pilgrim lifecycle and notification checks  |
| Expired booking      | Scheduler and unavailable workflow checks  |

## Platform Data

| Data          | Purpose                                                |
| ------------- | ------------------------------------------------------ |
| Announcements | Admin broadcast and app display                        |
| Feature flags | Emergency, festival, maintenance, booking availability |
| Settings      | Public configuration and admin settings updates        |

## Data Rules

- Use synthetic phone numbers and names.
- Do not use real government ID data.
- Keep staging and production data separated.
- Reset local data freely, but never reset staging or production without approval.
