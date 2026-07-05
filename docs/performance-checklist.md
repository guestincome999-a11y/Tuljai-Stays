# Tuljai Stays Performance Checklist

## Backend

- Completed: Public settings and feature flag reads use a short in-memory cache.
- Completed: Default settings and flags are seeded once per backend process.
- Completed: Admin updates invalidate configuration caches.
- Pending: Add request rate limiting for OTP, login, QR scan, and public discovery.
- Pending: Add background workers for exports, bulk notifications, and heavy reports.

## Database

- Completed: Added Prisma index definitions for high-volume reporting and operational tables.
- Needs Infrastructure: Generate and apply a Prisma migration for the new indexes.
- Pending: Enable slow query monitoring in production.
- Pending: Add staging data volume tests before launch.

## Pilgrim App

- Completed: Core booking and lodge lists are structured for virtualized rendering where high volume is expected.
- Pending: Add local short-lived cache for stable public configuration.
- Pending: Add image loading policies for low-bandwidth festival networks.

## Owner App

- Completed: Owner workflows are separated from backend business logic through API services.
- Pending: Convert any operational list that grows beyond a screenful into virtualized lists.
- Pending: Add upload compression before opening large photo-management workloads.

## Admin Panel

- Completed: Live operations uses real-time updates with refresh throttling and fallback polling.
- Pending: Lazy-load heavy analytics charts and reports.
- Pending: Move large exports to asynchronous jobs.

## Real-Time

- Completed: Real-time usage remains limited to approved operational workflows.
- Pending: Add Redis Socket.IO adapter for horizontal backend scaling.
- Pending: Add event throughput metrics.

## QR

- Completed: QR validation remains server-authoritative and uncached.
- Pending: Add dedicated scan rate limiting before public rollout.
- Pending: Add alerting for repeated invalid scan attempts.

## Notifications

- Completed: Notification and delivery log schema supports delivery audit trails.
- Pending: Add batched FCM sending for large admin announcements.
- Pending: Add delivery retry backoff configuration.

## Images

- Pending: Enforce image upload size and MIME validation at API boundaries.
- Pending: Generate compressed variants for lodge and room photos.
- Pending: Add signed URL expiry guidance for restricted images.

## Analytics

- Completed: Reporting tables now have supporting index definitions.
- Pending: Add materialized summaries if dashboard reports become slow.
- Pending: Add query-level performance budgets.

## Monitoring

- Pending: Add API latency, error rate, and database health dashboards.
- Pending: Add alerting for FCM failures, QR scan anomalies, and database saturation.
- Pending: Add production uptime monitoring.

## Security

- Completed: Configuration caching avoids user, booking, session, guest identity, and QR validation data.
- Pending: Add platform-wide rate limits and security event alerts.
- Pending: Review production headers and deployment TLS configuration.
