# Health Checks

## Backend Health URL

Local:

```text
http://localhost:4000/api/health
```

Production:

```text
https://YOUR_BACKEND_HOST/api/health
```

## Current Response

The health endpoint reports:

- API service identity
- Overall status
- Database reachability
- Firebase configuration status
- Supabase Storage configuration status
- Realtime foundation status
- Timestamp

Expected healthy response:

```json
{
  "service": "tuljai-stays-api",
  "status": "ok",
  "database": "ok",
  "firebaseConfigured": true,
  "storageConfigured": true,
  "realtime": "ok",
  "timestamp": "2026-07-05T00:00:00.000Z"
}
```

Firebase and storage may be `false` in local development until credentials are configured.

## Render Configuration

- Backend health check path: `/api/health`
- Treat database `error` or status `degraded` as a release blocker.
- Check health immediately after deploy and after migrations.

## Manual Verification Checklist

- Backend responds at `/api/health`.
- Database status is `ok`.
- Admin panel can reach backend.
- Socket.IO connection can authenticate.
- FCM and Supabase flags match environment expectations.
