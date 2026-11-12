# Deployment and operations audit — checkpoint

Evidence: Render connector list_services and list_deploys on 2026-10-28, user-selected workspace tea-d9hk3e58nd3s73d746i0.

| Service | ID | Plan/region/instances | Live revision | Health configuration |
|---|---|---|---|---|
| tuljai-stays-backend | srv-d9hkehmpbkes73a8p940 | free / Oregon / 1 | 8ccc63076fb39f94db8575f1663e77cea21db2d6 | /api/health |
| tuljai-stays-admin | srv-d9hkp9km0tmc73b35d20 | free / Oregon / 1 | same | empty path |

Both track main with automatic deploy on commit and are not suspended. Backend deploy dep-dbfj8n6gej5s73aimtag finished 2026-10-26T11:14:41Z; admin dep-dbfj8n3sp5es73cr3pdg finished 11:15:23Z. Verified live deployment status does not prove functional health.

Backend build: `npm ci --include=dev && npm run build --workspace @tuljai/types && npm run build --workspace @tuljai/utils && npm run db:generate && npm run db:deploy && npm run build:backend`. Start: `npm run start:backend`, which itself executes Prisma migrate deploy before starting compiled Nest.

Admin build: `npm ci --include=dev && npm run build --workspace @tuljai/types && npm run build --workspace @tuljai/utils && npm run build --workspace @tuljai/shared && npm run build:admin`. Start: `npm run start:admin`.

Verified configuration concern: backend migrations run during build before backend compilation, and again at startup. A failed build can therefore leave an updated database serving older code. Review backward compatibility and separate release migration control; do not change production during this audit.

Verified source concern: backend/src/modules/health/health.controller.ts catches SELECT 1 failures and returns a degraded JSON body without throwing an HTTP error; realtime always reports ok. An HTTP status-based readiness check can accept this response despite database failure. Reproduce using an isolated unavailable database; expect readiness failure status. No failure injected into production.

Local HEAD ac78961b differs from live revision. Current deployment commit message reports admin room-type manage-scope fix; preceding ea61cd03 reports totalRooms zero DTO fix. Do not report those historical concerns as still deployed without inspecting this newer code.

Pending: live endpoint observation, bounded logs/metrics, deployment environment presence checks, backup/restore evidence, current remote ancestry, mobile installed build/OTA identity. Existing deployment docs describe Render PostgreSQL, while connected evidence identifies a Supabase project; backend connection identity still needs explicit matching.
