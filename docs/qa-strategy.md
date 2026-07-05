# Tuljai Stays QA Strategy

## Scope

This QA strategy covers backend APIs, pilgrim app, owner app, admin panel, realtime events, QR workflows, notifications, environment readiness, and production acceptance.

## Environments

| Environment     | Purpose                      | Backend URL                     | Database                                | Admin Panel               | Mobile Config             | Notifications                 | QR Testing                         |
| --------------- | ---------------------------- | ------------------------------- | --------------------------------------- | ------------------------- | ------------------------- | ----------------------------- | ---------------------------------- |
| Local           | Developer validation         | `http://localhost:4000/api`     | Local PostgreSQL                        | Local Next.js             | Local API URL             | Optional or disabled          | Emulator and local physical device |
| Staging         | Release candidate validation | Staging HTTPS URL               | Staging PostgreSQL                      | Staging admin URL         | Staging API URL           | Test Firebase credentials     | Real devices and test lodges       |
| Production-like | Final dress rehearsal        | Production-equivalent HTTPS URL | Restored/synthetic production-like data | Production-like admin URL | Release candidate API URL | Production-style test devices | Real devices only                  |
| Production      | Live operations              | Production HTTPS URL            | Production PostgreSQL                   | Production admin URL      | Production API URL        | Production Firebase           | Smoke tests only                   |

No environment documentation should include real secrets.

## Roles

- Pilgrim user
- Owner user
- Backend `ADMIN`
- Backend `SUPER_ADMIN`
- Admin panel personas: Operations Manager, Support Executive, Photo Reviewer, Finance Admin, Analyst

## Test Data

Use clearly marked test users, lodges, rooms, bookings, QR tokens, announcements, feature flags, and settings. Do not use real guest identity data in staging.

## Manual Testing

Manual QA is required for:

- Real-device QR scan
- Push notification delivery
- Owner foreground booking alerts
- Admin role visibility
- Offline and slow-network behavior
- Accessibility and responsive layout checks

## Automated Testing Foundation

No dedicated automated test framework is currently configured. Recommended future automation:

- Backend API smoke tests for auth, health, booking, QR, and settings
- Admin route smoke tests for protected routes and permission gates
- Mobile critical path tests for login, discovery, booking, and QR display
- QR integration tests for valid, expired, used, wrong lodge, and tampered payloads

## Regression Testing

Run regression checks before every release candidate and after any migration, security, or deployment change.

## Security and Performance References

- Security: `docs/security-hardening-report.md`
- Performance: `docs/performance-optimization-report.md`
- Deployment: `docs/deployment-checklist.md`

## Production Sign-Off

Production release requires:

- Verification commands pass.
- Critical workflow matrices pass.
- Real-device QR flow passes.
- Staging deployment passes.
- Rollback and backup plans are ready.
- QA sign-off report is completed.
