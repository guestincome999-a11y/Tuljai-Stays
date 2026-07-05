# Tuljai Stays Capacity Planning

## Planning Targets

The current architecture should be prepared for the following MVP targets:

- 1,000+ simultaneous pilgrim app users
- 250+ active lodge owner users
- Multiple concurrent admin operators
- Festival and Navratri traffic spikes
- Thousands of QR scans per day
- High announcement and push notification fan-out during peak periods

These are planning targets, not measured production numbers. Final capacity must be validated with staging load tests.

## Expected Load Profiles

| Workflow            | Load Pattern                   | Scaling Consideration                              |
| ------------------- | ------------------------------ | -------------------------------------------------- |
| Lodge discovery     | Read-heavy and bursty          | Pagination, indexed filters, CDN-backed images     |
| Availability checks | Moderate read/write contention | Short locks, indexed booking date queries          |
| Booking decisions   | Owner-driven bursts            | Transaction safety and owner alert delivery        |
| QR check-in         | Short festival spikes          | Token verification, indexed scan logs, fast writes |
| Admin operations    | Low user count, heavy queries  | Server-side filtering and indexed reports          |
| Notifications       | Fan-out bursts                 | Queue-backed delivery before large campaigns       |

## Database Capacity

PostgreSQL is the primary scaling boundary for the MVP.

Recommended production posture:

- Use managed PostgreSQL with automated backups.
- Keep connection pooling enabled for Render deployments.
- Apply indexes for booking reports, QR scan logs, notifications, announcements, and audit logs.
- Monitor slow queries above 300 ms.
- Move exports and long-running reports to background jobs before festival launch.

Growth estimates should be calculated from:

- Bookings per day
- Guests per booking
- QR scan attempts per booking
- Notifications per booking lifecycle
- Admin audit events per operational action
- Lodge photos per lodge and average image size

## API Capacity

Recommended API settings for first production rollout:

- Horizontal backend scaling when sustained CPU exceeds 70 percent.
- Request timeout limits for report and export endpoints.
- Rate limits for OTP, QR scan, login, and public discovery endpoints.
- Health checks for database, storage, FCM configuration, and Socket.IO readiness.

The settings and feature flag cache reduces repeated reads for public app startup traffic.

## Real-Time Capacity

Socket.IO should be reserved for operational events:

- Booking updates
- Owner booking alerts
- QR check-in and checkout events
- Room availability changes
- Admin announcements

For multiple backend instances, use a shared Socket.IO adapter such as Redis so events reach clients connected to different instances.

## Mobile Capacity

Mobile apps should assume intermittent networks and festival congestion.

Recommended posture:

- Keep screens resilient to partial loading and retries.
- Use virtualized lists for lodge, booking, notification, and register views.
- Compress lodge photos before upload.
- Cache stable public configuration locally with short expiry.
- Avoid background polling when real-time events are available.

## Storage Capacity

Supabase Storage should hold lodge and room photos, not identity documents unless a future compliance review approves that scope.

Planning formula:

`monthly storage growth = new lodges * average photos per lodge * average compressed image size`

Recommended controls:

- Image size limits
- Content type validation
- Private buckets where required
- Expiring signed URLs for restricted assets

## Notification Capacity

FCM is suitable for MVP push delivery.

Before large admin announcements:

- Batch sends.
- Track delivery logs.
- Retry transient failures.
- Avoid sending duplicate alerts to inactive or duplicate device tokens.

## Render Deployment Notes

- Start with separate Render services for backend and admin panel.
- Use managed PostgreSQL and environment variables for secrets.
- Enable health checks.
- Add Redis when multiple backend instances are introduced.
- Keep paid services optional and replaceable where practical.

## Load Testing Plan

Before production launch:

- Test public app startup with settings, feature flags, discovery, and announcements.
- Test concurrent lodge discovery and availability checks.
- Test owner accept/reject bursts.
- Test QR scans with valid, expired, used, and invalid payloads.
- Test admin dashboards with production-like report volume.
- Test notification fan-out with staged device tokens.
