# Admin Business Intelligence

Module 05 Sequence 07 adds the Executive Business Intelligence Center.

## Routes

- `/admin/executive`
- `/admin/revenue`
- `/admin/analytics`
- `/admin/performance`
- `/admin/exports`

## Executive Dashboard

The executive dashboard combines:

- `GET /api/admin/dashboard/summary`
- `GET /api/admin/reports/bookings`
- `GET /api/admin/notifications/metrics`
- `GET /api/owner/qr-scans`

It displays executive KPIs, booking acceptance, cancellation, occupancy, QR success, notification delivery, business scorecards, and executive insight cards.

## Revenue Dashboard

The revenue dashboard uses:

- `GET /api/admin/reports/bookings`
- `GET /api/admin/reports/commission`

It shows revenue estimates, commission estimates, average booking value, daily revenue bars, and top revenue lodge ranking. Settlement and pending commission values are not fabricated.

## Analytics

Analytics include booking status distribution, occupancy, QR efficiency, notification delivery, customer analytics foundation, geographic insights foundation, seasonal analytics foundation, and predictive analytics foundation.

## Performance Rankings

Performance ranking uses booking report and commission report data to score lodges by booking volume, revenue, and commission. Owner response time, complaint count, online availability, and missed booking metrics require future backend dimensions.

## Predictive Analytics Foundation

Forecasting panels are prepared for expected occupancy, booking load, peak festival hours, QR volume, staff requirements, and expected revenue. These are foundation-only until historical trend or predictive services are exposed.

## Export Center

The export center prepares filters and formats for CSV, Excel, and PDF exports across bookings, revenue, commission, lodges, owners, rooms, QR reports, notification reports, audit reports, and analytics.

Required future APIs:

- `POST /api/admin/exports`
- `GET /api/admin/exports`
- Scheduled report worker
- Optional email delivery service

## Permissions

- `analytics.view` protects executive and analytics dashboards.
- `reports.view` protects performance rankings.
- `reports.export` protects export requests.
- `finance.view` protects revenue-sensitive pages.

Revenue-sensitive data should remain accessible only to Finance Admin and Super Admin unless explicitly approved.

## Known Limitations

- Settlement reports require backend payment integration.
- Predictive analytics are trend/foundation panels until predictive models are added.
- Email scheduling requires a backend scheduler and mail provider.
- Commission reports depend on finalized commission models.
- Customer and geographic analytics need dedicated backend dimensions.
- Owner performance requires owner response-time and missed-booking metrics.

## Next Sequence Recommendation

Module 05 Sequence 08 should focus on final admin QA, accessibility, visual consistency, role-by-role validation, and production-readiness documentation.
