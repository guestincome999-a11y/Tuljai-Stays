# Infrastructure Limitations

## Render

- Free or low-tier services may cold start.
- Automated backup availability depends on the PostgreSQL tier.
- Horizontal scaling may require paid tiers and Redis.

## Realtime

- Redis is not required for one backend instance.
- Redis is required before reliable multi-instance Socket.IO delivery.

## Observability

- Render logs are enough for MVP operations.
- Full tracing, metrics dashboards, and long-term log retention may need paid or external services later.

## Backups

- PostgreSQL backup automation depends on provider tier.
- Supabase Storage backup automation must be confirmed separately.

## Notifications

- Push notifications require valid production Firebase credentials.
- Real device testing is required before depending on push for critical workflows.

## Domains and HTTPS

- A custom domain is optional initially.
- Production backend and admin URLs must use HTTPS.
- Mobile production builds must point to HTTPS APIs.
