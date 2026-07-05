# Release Strategy

## Branches

- `main`: stable production-ready code.
- `development`: optional integration branch before release.
- `release/<version>`: release candidate stabilization.
- `hotfix/<issue>`: urgent production fixes from the latest production tag.

## Tags

Recommended milestones:

- `backend-v1-complete`
- `pilgrim-app-v1-complete`
- `owner-app-v1-complete`
- `admin-dashboard-v1-complete`
- `production-rc1`

Use semantic version tags for deployable releases:

- `v1.0.0-rc.1`
- `v1.0.0`
- `v1.0.1`

## Release Candidate Flow

1. Create release branch.
2. Run full verification.
3. Deploy to staging.
4. Run deployment checklist.
5. Tag release candidate.
6. Deploy backend and admin.
7. Configure mobile builds.
8. Tag production release after approval.

## Rollback Tags

Keep the previous stable production tag visible. If production fails after deploy, rollback the backend/admin service to the previous tag and follow the rollback plan for database changes.
