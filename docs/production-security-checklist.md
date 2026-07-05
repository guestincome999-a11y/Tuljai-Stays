# Production Security Checklist

## Backend

- Completed: Credentialed HTTP CORS is restricted by `ALLOWED_ORIGINS`.
- Completed: Helmet is enabled with production HSTS.
- Completed: Backend request body size is limited by `API_BODY_LIMIT_BYTES`.
- Completed: Production rejects placeholder JWT secrets.
- Pending: Add global rate limiting for public read and write endpoints.
- Pending: Add dependency audit to CI.

## Authentication

- Completed: OTPs are hashed before storage.
- Completed: OTP request rate limiting and attempt limits are present.
- Completed: Refresh tokens are stored as hashes.
- Completed: Auth DTOs have maximum sizes for token and device fields.
- Completed: Development OTP responses are blocked in production.
- Pending: Add suspicious login alerting.

## Authorization

- Completed: JWT guard foundation is active.
- Completed: Role guard foundation is active.
- Completed: Owner lodge access service protects owner workflows.
- Pending: Run endpoint-by-endpoint authorization tests before launch.

## Realtime

- Completed: Socket.IO browser origins are restricted by `ALLOWED_ORIGINS`.
- Completed: Realtime clients authenticate with JWTs.
- Pending: Add Redis adapter security review before horizontal realtime scaling.
- Pending: Add connection rate limiting.

## Data Protection

- Completed: OTP audit phone numbers are masked.
- Completed: QR payloads remain pilgrim-safe and server-verifiable.
- Completed: Refresh tokens and QR internal tokens are hashed.
- Pending: Add formal data retention policy for audit logs, QR scans, sessions, and guest registers.
- Pending: Encrypt highly sensitive identity data at rest if future compliance requires it.

## Admin Panel

- Completed: Admin routes are protected by auth and permission gates.
- Completed: Tokens are not placed in public environment variables.
- Pending: Consider httpOnly cookie sessions for admin production deployment.
- Pending: Add stricter browser security headers at the Next.js deployment edge.

## Mobile Apps

- Completed: Mobile tokens use secure storage.
- Completed: Public configuration does not include secrets.
- Pending: Add jailbreak/root detection only if future risk assessment requires it.
- Pending: Add certificate pinning only if operational support can maintain it safely.

## Storage

- Completed: Supabase service role key is backend-only.
- Pending: Enforce upload MIME type, size, and extension allowlists at signed upload creation.
- Pending: Use expiring signed URLs for restricted assets.

## Monitoring

- Completed: Important actions create audit entries.
- Pending: Add security dashboards for failed OTP, invalid QR scans, admin actions, and permission denials.
- Pending: Add alert thresholds for suspicious activity.
