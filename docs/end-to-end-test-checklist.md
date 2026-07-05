# End-To-End Test Checklist

Use this checklist for integrated QA across backend, pilgrim app, owner app, and admin dashboard.

| Scenario                  | Expected Result                                                                                          | Actual Result        | Dependencies                                             | Limitations                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| New pilgrim booking       | New pilgrim logs in, browses lodge, checks availability, creates booking in `PENDING_OWNER_APPROVAL`.    | Pending QA execution | Auth, lodges, availability, booking lock, booking create | Payment is foundation only                               |
| Returning pilgrim booking | Existing pilgrim session restores and can create another booking.                                        | Pending QA execution | Token/session storage, booking APIs                      | Refresh-token behavior should be device-tested           |
| Owner acceptance          | Owner receives booking, accepts, pilgrim sees accepted status and QR availability.                       | Pending QA execution | Owner booking APIs, notifications, realtime              | Owner offline fallback depends on polling/manual refresh |
| Owner rejection           | Owner rejects with reason, pilgrim sees rejected state and notification.                                 | Pending QA execution | Owner booking APIs, notification events                  | Refund/payment handling not applicable yet               |
| Admin intervention        | Admin sees pending/overdue booking and can manually update status with reason.                           | Pending QA execution | Admin booking APIs, RBAC                                 | Notes/escalation persistence pending                     |
| QR success                | Pilgrim QR displays signed payload; owner scans; backend validates; booking checks in; register unlocks. | Pending QA execution | QR payload, owner scanner, QR scan API, register API     | Camera/device QA required                                |
| QR failure                | Invalid payload is rejected with user-safe error and scan log.                                           | Pending QA execution | QR scan API, scan logging                                | Exact error text should be verified on device            |
| Wrong lodge scan          | Owner from another lodge is rejected and scan is logged as wrong lodge/unauthorized.                     | Pending QA execution | Lodge ownership, QR validation                           | Requires multi-owner test data                           |
| Duplicate scan            | Used QR is rejected on second scan.                                                                      | Pending QA execution | QR token status, scan logging                            | Requires repeat scan test                                |
| Check-in                  | Successful QR scan creates/updates guest register and room occupancy.                                    | Pending QA execution | QR scan, register, room update                           | Register document verification is owner workflow         |
| Checkout                  | Owner checks out register; booking/room move toward completed/available state.                           | Pending QA execution | Register checkout API                                    | Room cleaning workflow may require manual status update  |
| Register verification     | Owner opens unlocked register and marks ID verified/notes.                                               | Pending QA execution | Register APIs                                            | Guest contact remains gated by QR verification           |
| Festival mode             | Admin enables festival mode; public consumers reflect festival banner/mode.                              | Pending QA execution | Feature flags public endpoint, public settings           | Owner direct flag consumption remains future enhancement |
| Emergency mode            | Admin enables emergency mode and broadcasts emergency announcement.                                      | Pending QA execution | Feature flags, settings, announcements, realtime         | Scoped pauses require backend model                      |
| Maintenance mode          | Admin sets maintenance message and enables maintenance flag.                                             | Pending QA execution | Settings, feature flags                                  | App-side hard blocking should be expanded in future      |
| Session expiration        | Expired/invalid token causes friendly auth failure and login redirect.                                   | Pending QA execution | Auth guards, client session handling                     | httpOnly cookie auth pending                             |
| Permission denial         | Restricted admin role sees permission denied and cannot access blocked actions.                          | Pending QA execution | Frontend permissions, backend guards                     | Advanced backend role enforcement may need expansion     |
| Announcement broadcast    | Admin announcement appears in pilgrim/owner/admin announcement surfaces and realtime events.             | Pending QA execution | Announcement APIs, realtime, notification service        | Push provider delivery depends on FCM config             |

## QA Notes

- Use seeded data with at least one pilgrim, owner, admin, verified lodge, room type, room, and accepted booking.
- Test Android emulator and physical device camera scanning for owner QR flow.
- Test admin web with at least SUPER_ADMIN, ADMIN, FINANCE_ADMIN, PHOTO_REVIEWER, SUPPORT_EXECUTIVE, and ANALYST accounts.
- Record backend logs and audit records during destructive/sensitive scenarios.
