# Versioning Strategy

## Current Versions

| Component       | Current Version |
| --------------- | --------------- |
| Pilgrim app     | `0.1.0`         |
| Owner app       | `0.1.0`         |
| Backend package | `0.1.0`         |
| Admin package   | `0.1.0`         |
| Root workspace  | `0.1.0`         |

## Mobile App Versioning

- `version`: user-visible app version.
- Android `versionCode`: must increase for every Play Store upload.
- iOS build number: must increase for every TestFlight/App Store upload.
- Add build numbers when EAS configuration is introduced.

## Backend and Admin Versioning

- Use Git tags and deployment commit SHA.
- Keep backend and admin compatible with current mobile app versions.
- Document breaking API changes before raising minimum supported app version.

## Release Candidate Naming

- `v1.0.0-rc.1`
- `v1.0.0-rc.2`
- `production-rc1`

## Production Tags

- `backend-v1-complete`
- `pilgrim-app-v1-complete`
- `owner-app-v1-complete`
- `admin-dashboard-v1-complete`
- `v1.0.0`

## Hotfix Process

1. Branch from latest production tag.
2. Apply narrowly scoped fix.
3. Run verification and smoke tests.
4. Tag patch release such as `v1.0.1`.
5. Deploy backend/admin or submit mobile update as needed.

## Minimum Supported App Version

Use platform setting `minimum_app_version` to warn or block outdated clients when a compatible backend requires newer mobile behavior.

## Force Update Strategy

Use `force_update_enabled` and `force_update_message` only for critical security, compatibility, or data safety issues.
