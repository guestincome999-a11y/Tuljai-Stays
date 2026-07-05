# Admin Permission Matrix

This matrix reflects the current frontend RBAC mapping in `apps/admin-panel/src/permissions/permissions.ts`.

## Role Summary

| Role                 | Visible Sidebar Items                                                                  | Allowed Routes                                                       | Blocked Routes                                                   | Allowed Actions                                                           | Sensitive Data                                | Export Access                          | Override Access        | Settings Access                                            |
| -------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| `SUPER_ADMIN`        | Everything                                                                             | All admin routes                                                     | None                                                             | All mapped actions                                                        | Full admin-visible data                       | Yes                                    | Yes                    | Full                                                       |
| `ADMIN`              | Dashboard, operations, bookings, governance, settings, flags, monitoring, analytics    | Broad operational routes except finance-only revenue/export override | Revenue, exports, finance-only actions                           | Booking/lodge/room/photo/platform operations                              | Guest contact where booking manage applies    | No report export permission by default | No `bookings.override` | Settings and feature flags                                 |
| `OPERATIONS_MANAGER` | Dashboard, live ops, bookings, lodges, owners, rooms, announcements, emergency, health | Operations and governance work queues                                | Finance, analytics, audit, feature flags, exports                | Manage bookings, lodges, owners, rooms, announcements, emergency controls | Operational data only                         | No                                     | No                     | Emergency/security controls only through mapped permission |
| `SUPPORT_EXECUTIVE`  | Dashboard, bookings, live operations, support placeholders                             | Booking support and operations view                                  | Finance, security, settings, governance management, exports      | Call/support workflows, support notes foundation                          | Booking contact where support workflow allows | No                                     | No                     | None                                                       |
| `PHOTO_REVIEWER`     | Dashboard, lodges, photo review                                                        | Photo review and limited lodge context                               | Bookings, finance, settings, security, exports                   | Approve/reject photos                                                     | No finance/security data                      | No                                     | No                     | None                                                       |
| `FINANCE_ADMIN`      | Dashboard, reports, exports, revenue, settings                                         | Revenue, commission, export, finance settings                        | Security, emergency controls, feature flags, operations mutation | Commission setting and finance reports                                    | Revenue/commission data                       | Yes                                    | No                     | Commission-related settings only in UI                     |
| `ANALYST`            | Dashboard, reports placeholder, analytics, system health                               | Read-only analytics and health                                       | Bookings management, finance, security, settings, exports        | Read-only review of analytics                                             | No sensitive operational controls             | No                                     | No                     | None                                                       |

## Validation Rules

- `SUPER_ADMIN` inherits all permissions through backend and frontend checks.
- Analysts must not mutate settings, bookings, lodges, rooms, photos, security, or finance data.
- Photo reviewers must not see revenue, security, platform control, or booking override areas.
- Finance admins can see revenue/commission and exports, but not emergency/security controls.
- Support executives can support booking workflows but cannot access finance/security/platform controls.
- Operations managers can operate booking/lodge/room queues and emergency controls, but cannot export reports or view finance-only revenue.

## Sensitive Actions

- Booking manual status updates require `bookings.manage`.
- Booking override options require `bookings.override`.
- Settings changes require `settings.manage`; finance settings additionally require `finance.manage` in the UI.
- Feature flags require `feature_flags.manage`.
- Emergency and security pages require `security.manage`.
- Exports require `reports.export`.
- Revenue dashboard requires `finance.view`.
