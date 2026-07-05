# Logging Strategy

## Backend Logs

- Use NestJS and Render service logs for application lifecycle events.
- Keep operational events in audit logs where persistence is required.
- Avoid logging request bodies for auth, QR, guest register, or upload operations.

## Persistent Operational Logs

- Audit logs: important admin, auth, owner, settings, and operational actions.
- QR scan logs: scan result, lodge context, and validation outcome.
- Notification logs: delivery attempts and provider status.
- Booking history: lifecycle transitions.
- Register audit logs: check-in, checkout, and register changes.

## Admin Errors

- Admin panel build/runtime errors appear in Render logs.
- User-facing errors should remain generic and avoid exposing backend internals.

## Mobile Crash Logs

- Future production mobile crash reporting can be added with an optional provider.
- Keep paid crash reporting optional and replaceable.

## Do Not Log

- OTP codes
- JWT access tokens
- Refresh tokens
- Raw QR payloads
- QR token hashes
- FCM tokens
- Supabase service role keys
- Government ID numbers
- Full guest addresses
- Full guest sensitive details

## Render Logs

- Use Render logs for deployment and process errors.
- Export logs only to approved destinations.
- Limit log access to trusted operators.
