# Tuljai Stays Performance Optimization Report

## Scope

Module 06 Sequence 02 focused on platform performance foundations only. No booking, QR, payment, notification, review, or admin business behavior was changed.

## Bottlenecks Found

- Public settings and feature flag endpoints loaded default records and queried the database on every request.
- Reporting and operations queries frequently filter or sort high-volume tables by `createdAt`, `status`, `cityId`, `result`, `category`, or `isActive`.
- QR scan logs, notification delivery logs, announcements, and audit logs are expected to grow quickly during festival periods.
- Mobile and owner apps contain several screen-level lists. Core pilgrim lists already use virtualized lists where volume is expected, while smaller owner operational lists remain acceptable until real usage data shows pressure.
- Admin live operations already uses real-time updates with a debounce and polling fallback, which is suitable for the current foundation.

## Optimizations Completed

| Area                  | Optimization                                                                                                                 | Result                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Backend configuration | Added a 30-second in-memory cache for system settings and feature flags.                                                     | Reduces repeated database reads for high-frequency public configuration calls. |
| Backend defaults      | Settings and feature flag defaults are now ensured once per process, with concurrent callers sharing the same promise.       | Prevents repeated upsert loops during normal reads.                            |
| Cache invalidation    | Settings and feature flag caches are invalidated immediately after admin updates.                                            | Keeps reads fast while preserving update correctness.                          |
| Database schema       | Added Prisma indexes for booking reports, QR scan logs, notification lists, announcement filtering, and audit action lookup. | Prepares high-volume queries for production load and reporting usage.          |
| Documentation         | Added capacity planning and performance checklist documents.                                                                 | Provides clear operating guidance for production rollout.                      |

## Database Indexes Added

- `Booking`: `createdAt`, `status + createdAt`, `cityId + createdAt`
- `QrScanLog`: `createdAt`, `result + createdAt`
- `Notification`: `createdAt`
- `NotificationDeliveryLog`: `status + createdAt`
- `Announcement`: `category + isActive`, `startsAt + expiresAt`, `createdAt`
- `AuditLog`: `action`

These indexes support administrative reporting, live operations, festival monitoring, notification auditing, and QR scan analysis.

## Caching Strategy

| Data                   | Current Strategy                                           | Expiry                  | Invalidation              |
| ---------------------- | ---------------------------------------------------------- | ----------------------- | ------------------------- |
| Public system settings | Backend in-memory cache                                    | 30 seconds              | On setting update         |
| Admin system settings  | Backend in-memory cache                                    | 30 seconds              | On setting update         |
| Public feature flags   | Backend in-memory cache                                    | 30 seconds              | On feature flag update    |
| Admin feature flags    | Backend in-memory cache                                    | 30 seconds              | On feature flag update    |
| Lodge discovery        | API pagination and client refresh                          | Request scoped          | Future short client cache |
| Availability           | No broad cache                                             | Live calculation        | Lock and booking changes  |
| Booking operations     | No cache                                                   | Live data               | Not cached by design      |
| QR payloads and scans  | No cache                                                   | Token expiry controlled | Single-use validation     |
| Admin live operations  | Socket updates with debounced refresh and polling fallback | Event driven            | Server events             |

Security-sensitive data such as sessions, JWT state, booking decisions, QR verification, guest identity, and owner authorization remains uncached at the service level.

## Backend Notes

- Keep pagination mandatory on list endpoints before production launch.
- Use cursor pagination for high-volume logs once offset pagination becomes slow.
- Avoid adding broad caches to booking, QR, or authentication flows because correctness matters more than read speed.
- Move configuration caches to Redis only when horizontal backend instances need shared invalidation.

## Mobile Notes

- Pilgrim discovery and booking lists should continue using virtualized list components.
- Keep expensive formatting and filtering in hooks or service mappers rather than render bodies.
- Add image compression and size variants before large lodge photo uploads are opened to owners.
- Introduce persisted read-through cache only for stable public data such as city metadata and feature flags.

## Admin Notes

- Keep admin dashboards paginated and filtered server-side.
- Use live events for operational deltas and avoid full dashboard refreshes for every socket message.
- Add chart-level lazy loading for analytics pages as data volume grows.
- Export/report jobs should move to background processing before production-scale CSV or PDF exports.

## Real-Time Notes

- Socket.IO should remain limited to booking updates, owner alerts, QR events, room availability changes, and admin announcements.
- High-frequency operational events should be grouped or debounced per client view.
- Add event delivery metrics before festival launch.

## Production Recommendations

- Generate and apply a Prisma migration for the new indexes in the target PostgreSQL database.
- Run load tests against staging with production-like data before opening festival traffic.
- Add database slow query logging and API latency monitoring.
- Add Redis only when deployment uses multiple backend instances or public configuration traffic becomes significant.
