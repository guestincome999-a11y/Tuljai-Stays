# Rollback Plan

## Backend Rollback

- Use Render deploy history or deploy the previous Git tag.
- Verify `/api/health`.
- Confirm admin login and core booking read paths.
- Keep database compatibility in mind before rolling code back.

## Admin Panel Rollback

- Redeploy previous admin panel version.
- Confirm `NEXT_PUBLIC_API_BASE_URL` still points to the active backend.
- Confirm admin login and dashboard load.

## Database Rollback

- Prefer forward fixes.
- Restore backup only for confirmed destructive migration or data corruption.
- Stop writes before restore.
- Restore to a new database when possible and repoint backend after verification.

## Feature Flag Rollback

- Disable risky behavior through feature flags.
- Use maintenance mode or booking pause when operational risk is high.
- Record reason and operator in audit logs where supported.

## Mobile Rollback Limitation

Mobile releases are hard to roll back after store distribution. Use feature flags, backend compatibility, and staged rollout to control risk.

## Communication Plan

- Assign incident owner.
- Notify admins and support operators.
- Use admin announcements only when end users need guidance.
- Record timeline, decision, and follow-up actions.
