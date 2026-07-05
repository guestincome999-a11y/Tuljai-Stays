# Admin Monitoring Center

Module 05 Sequence 06 adds the Enterprise Monitoring and Security Center.

## Routes

- `/admin/system-health`
- `/admin/api-health`
- `/admin/notifications-monitor`
- `/admin/qr-monitor`
- `/admin/security`
- `/admin/sessions`
- `/admin/backups`
- `/admin/audit`

## System Health

The system health dashboard uses existing endpoints:

- `GET /api/health`
- `GET /api/admin/dashboard/summary`
- `GET /api/admin/realtime/presence`
- `GET /api/admin/notifications/metrics`
- `GET /api/owner/qr-scans`
- `GET /api/admin/settings`
- `GET /api/admin/feature-flags`

It displays platform, backend, database, realtime, storage, notifications, QR, background jobs, cache, and gateway health. CPU, memory, disk, cache, and worker uptime are marked as instrumentation requirements when not exposed by the backend.

## API Diagnostics

The API diagnostics route lists critical API groups and available health signals. Response time, P95, error rate, success rate, and last failure require a backend diagnostics endpoint.

## Database Monitoring

The current health endpoint checks database reachability with `SELECT 1`. Connection pool, slow queries, migration version, storage usage, and replication status require backend instrumentation.

## Socket Monitoring

Realtime presence uses `GET /api/admin/realtime/presence` for connected owners, pilgrims, admins, and total active sockets. Reconnect and disconnect rates require gateway metrics.

## QR Monitoring

The QR monitor uses `GET /api/owner/qr-scans` and summarizes successful check-ins, invalid scans, expired QR attempts, duplicate usage, wrong lodge failures, and QR success percentage.

## Notification Monitoring

Notification monitoring uses `GET /api/admin/notifications/metrics` to show sent, delivered, failed, read, invalid tokens, failure rate, recent failures, and delivery success. Push queue and retry queue depth require provider queue instrumentation.

## Security Center

Security center displays currently available security-sensitive signals and links to sessions/audit. Failed login, locked account, permission change, blocked device, and token invalidation visibility require a read API over audit/security events.

## Sessions

The sessions route shows the current admin session from local auth state. Full active admin, owner, and pilgrim session management requires:

- `GET /api/admin/sessions`
- `POST /api/admin/sessions/:id/revoke`

IP addresses should be masked unless the viewer has explicit security permission.

## Audit Explorer

The audit page was expanded with filters and the expected audit API shape. Backend services already write audit records, but a public admin read endpoint is still required:

- `GET /api/admin/audit-logs`

## Infrastructure And Backups

Backup and infrastructure pages document future backend support for backup runs, verification, restore, storage usage, scheduled backups, Redis, workers, CPU, memory, and disk metrics. No fake backup status is displayed.

## Known Limitations

- Infrastructure metrics require backend endpoints.
- CPU, memory, and disk require server instrumentation.
- Redis monitoring depends on deployment.
- Backup actions require backend services.
- Push queue monitoring depends on notification provider instrumentation.
- Pilgrim and owner session inventories are not exposed yet.
- Audit visibility is limited until an audit read endpoint exists.

## Next Sequence Recommendation

Module 05 Sequence 07 should focus on final admin QA, route-by-route validation, accessibility, and any backend read endpoints needed by monitoring and audit.
