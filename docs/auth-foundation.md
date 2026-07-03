# Authentication Foundation

Module 02 Sequence 01 adds the backend foundation for OTP authentication, users, roles, refresh tokens, sessions, device tokens, and auth audit logs.

## Flow

1. A client calls `POST /api/auth/request-otp` with a phone number, purpose, and app type.
2. The backend validates the phone number and applies a database-backed OTP request rate limit.
3. The backend generates an OTP, stores only a salted hash, records expiry and attempt limits, and creates an audit log.
4. A client calls `POST /api/auth/verify-otp` with the OTP and device metadata.
5. The backend validates the OTP, creates the user if needed, issues JWT and refresh tokens, stores only the refresh token hash, creates a session, optionally stores an FCM device token, updates `last_login_at`, and writes audit logs.
6. Clients use the access token for authenticated APIs and `POST /api/auth/refresh-token` to obtain a new access token.
7. Logout revokes the refresh token, marks the session inactive, optionally deactivates device tokens, and writes audit logs.

## APIs

| Method | Path                      | Auth | Purpose                                           |
| ------ | ------------------------- | ---- | ------------------------------------------------- |
| `POST` | `/api/auth/request-otp`   | No   | Create hashed OTP request                         |
| `POST` | `/api/auth/verify-otp`    | No   | Verify OTP, create/bootstrap user, issue tokens   |
| `POST` | `/api/auth/refresh-token` | No   | Issue a new access token from valid refresh token |
| `POST` | `/api/auth/logout`        | Yes  | Revoke refresh token and deactivate session       |
| `GET`  | `/api/auth/me`            | Yes  | Return active user profile                        |
| `POST` | `/api/auth/device-token`  | Yes  | Register or update FCM token                      |

## Environment Variables

| Variable                        | Default | Notes                                                 |
| ------------------------------- | ------- | ----------------------------------------------------- |
| `JWT_ACCESS_SECRET`             | none    | Required                                              |
| `JWT_REFRESH_SECRET`            | none    | Required                                              |
| `JWT_ACCESS_TOKEN_TTL`          | `15m`   | Used for access token expiry                          |
| `JWT_REFRESH_TOKEN_TTL`         | `30d`   | Used for refresh token persistence expiry             |
| `OTP_TTL_SECONDS`               | `300`   | OTP expiry in seconds                                 |
| `OTP_MAX_ATTEMPTS`              | `5`     | Max verification attempts per OTP                     |
| `OTP_RATE_LIMIT_WINDOW_SECONDS` | `900`   | OTP request rate-limit window                         |
| `OTP_RATE_LIMIT_MAX_REQUESTS`   | `5`     | Max OTP requests per phone and purpose per window     |
| `ALLOW_DEV_OTP_RESPONSE`        | `false` | Returns OTP only when true and `NODE_ENV=development` |

## Security Notes

- Plain OTPs are never stored.
- Raw refresh tokens are never stored.
- OTPs use salted scrypt hashes.
- Refresh tokens use SHA-256 hashes for lookup.
- JWT secrets must come from environment variables.
- DTO validation is enabled globally.
- Auth errors use centralized exception handling.
- Super admin can access all role-gated routes.
- Admin routes should use `@Roles('ADMIN')`; the role guard also permits `SUPER_ADMIN`.
- Owner routes should use `@Roles('OWNER', 'ADMIN')`; the role guard also permits `SUPER_ADMIN`.

## Future Work

- Add SMS provider integration.
- Add persistent secure token storage in mobile apps.
- Add admin bootstrap or invite workflow.
- Add tests for OTP rate limiting, token refresh, logout, and RBAC.
- Add API throttling middleware if broader rate limits are needed beyond OTP requests.
