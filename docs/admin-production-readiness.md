# Admin Production Readiness

## Build Gates

- Typecheck: required before release.
- Lint: required before release.
- Build: required before release.
- Format check: required before release.

## Route Readiness

- All ready sidebar routes have a protected page.
- Placeholder routes redirect to dashboard through the shell.
- Unauthenticated access redirects to login.
- Permission-denied state is handled by `PermissionGate`.

## Permission Readiness

- Role mapping is centralized in the admin permissions module.
- Finance routes use finance permissions.
- Security routes use `security.manage`.
- Export route uses `reports.export`.
- Analyst role is read-only.

## Environment Configuration

- Admin API base URL is read from `NEXT_PUBLIC_API_BASE_URL` or `API_BASE_URL`.
- Production must not depend on localhost URLs.
- Render backend URL should be set as the API base URL in deployed admin environments.
- Secrets must remain server-side and never be added to public admin variables.

## Feature Flag Readiness

- Feature flags are managed in the Platform Control Center.
- Dangerous flags require reason and confirmation in the UI.
- App-side rollout percentage adoption remains future work.

## Monitoring Readiness

- Health, realtime presence, notification metrics, QR logs, and dashboard summaries are visible.
- Infrastructure metrics require additional backend instrumentation.
- Backup/restore actions are documented as foundations.

## Audit Readiness

- Backend services create audit logs for important actions.
- Admin audit read endpoint is still required for full audit explorer functionality.
- Sensitive UI actions request reason text where possible.

## Accessibility Readiness

- Admin shell has a skip link.
- Focus states are visible.
- Buttons, links, forms, status chips, and tables use readable text labels.
- Critical alerts include text, not color alone.

## Known Limitations

- httpOnly cookie auth is not yet implemented.
- Some advanced admin roles are frontend-ready and may need backend role persistence.
- Admin audit read endpoint may still be missing.
- Booking transfer persistence needs backend APIs.
- Admin notes and escalation persistence need backend APIs.
- Export jobs need backend workers.
- Predictive analytics need historical models.
- Infrastructure metrics need backend instrumentation.
- Full backup/restore controls need backend services.

## Release Decision

Module 05 is ready for internal operations testing after all verification commands pass and environment variables are configured for the target environment.
