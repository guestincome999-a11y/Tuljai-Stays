# Backup and Restore Strategy

## MVP Targets

- RPO: 24 hours
- RTO: 4 to 8 hours

These targets are planning defaults and must be finalized before launch.

## PostgreSQL Backups

- Use provider automated backups when available.
- Take a manual backup before production migrations.
- Keep at least daily backups for MVP launch.
- Store backup access securely with limited admin access.

## Backup Verification

- Restore a backup into staging monthly.
- Confirm migrations can run after restore.
- Confirm admin login and `/api/health`.
- Confirm sample booking, QR, notification, and register records load.

## Restore Procedure

1. Declare incident and pause risky operations with feature flags or maintenance mode.
2. Stop backend writes if corruption is suspected.
3. Select the backup point.
4. Restore to a new database when possible.
5. Verify schema and data.
6. Point backend to restored database.
7. Run smoke tests.
8. Reopen traffic.

## Supabase Storage

- Keep lodge and room photos in Supabase Storage.
- Document bucket policies before launch.
- Export bucket metadata and files regularly if provider tier does not automate storage backup.
- Use image object paths that can be reconstructed from database metadata.

## Emergency Restore Checklist

- Incident owner assigned
- Backup selected
- Current database preserved for investigation
- Restore completed
- Health check passed
- Admin login passed
- QR scan smoke test passed
- Owner dashboard smoke test passed
- Pilgrim discovery smoke test passed
