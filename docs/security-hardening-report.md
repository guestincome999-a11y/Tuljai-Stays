# Tuljai Stays Security Hardening Report

## Scope

Module 06 Sequence 03 reviewed and hardened production security controls without adding business features or changing booking, QR, lodge, owner, pilgrim, notification, or admin workflows.

## Security Weaknesses Confirmed

- Backend HTTP CORS allowed every browser origin while credentials were enabled.
- Socket.IO CORS also allowed every browser origin.
- OTP audit metadata stored full phone numbers for OTP request and failed login events.
- Authentication DTOs accepted important token and device fields without explicit maximum lengths.
- Production startup did not fail fast for placeholder JWT secrets or missing allowed browser origins.

## Improvements Completed

| Area                | Improvement                                                                         | Security Benefit                                                      |
| ------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| HTTP CORS           | Added `ALLOWED_ORIGINS` and restricted credentialed browser origins.                | Reduces cross-origin abuse risk against authenticated APIs.           |
| Socket.IO CORS      | Reused the same allowed-origin policy for realtime connections.                     | Prevents arbitrary browser origins from initiating realtime sessions. |
| Request size        | Added `API_BODY_LIMIT_BYTES` with a default 1 MB backend body limit.                | Limits oversized request payload abuse.                               |
| Production config   | Production now requires configured allowed origins and strong JWT secrets.          | Prevents unsafe placeholder deployment.                               |
| OTP audit metadata  | Phone numbers are masked before being written to audit metadata.                    | Reduces sensitive data exposure in operational logs.                  |
| Auth DTO validation | Added maximum lengths for device IDs, device names, FCM tokens, and refresh tokens. | Reduces abuse through oversized auth payloads.                        |
| Security docs       | Documented security posture, OWASP review, and production checklist.                | Creates a repeatable readiness baseline.                              |

## OWASP Review Summary

| OWASP Area                  | Current Status                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Broken access control       | JWT guards, role guards, and owner/lodge access checks are present. Continue endpoint-level review for every future module. |
| Cryptographic failures      | OTPs and refresh tokens are hashed before storage. JWT secrets are environment driven and now validated in production.      |
| Injection                   | Prisma query builders and DTO validation are used. Avoid raw SQL unless reviewed.                                           |
| Insecure design             | QR validation is server-authoritative and booking workflows remain backend-owned.                                           |
| Security misconfiguration   | CORS, Helmet, body limits, and production secret checks are now stronger.                                                   |
| Vulnerable components       | Dependency audit still needs to be run in CI before release.                                                                |
| Authentication failures     | OTP rate limits, attempt limits, hashed OTPs, refresh token revocation, and session tracking exist.                         |
| Software and data integrity | Git commits and environment validation are in place. CI signing is future work.                                             |
| Logging and monitoring      | Audit logs exist and sensitive OTP phone metadata is masked. Security alerting is future infrastructure work.               |
| SSRF                        | Storage uses configured Supabase client only. Future URL ingestion must validate external URLs.                             |

## Sensitive Data Handling

Do not log or expose:

- OTP codes
- JWTs
- Refresh tokens
- QR token hashes
- FCM tokens
- Supabase service role keys
- Full government ID values
- Full guest addresses
- Full phone numbers in logs or audit metadata unless explicitly required by a protected operational workflow

The system may store sensitive values when required for business workflows, but logs and audit metadata should use masked or referential values.

## Production Environment Requirements

Required backend variables:

- `NODE_ENV=production`
- `ALLOWED_ORIGINS=https://admin.example.com`
- `API_BODY_LIMIT_BYTES=1048576`
- Strong `JWT_ACCESS_SECRET` with at least 32 characters
- Strong `JWT_REFRESH_SECRET` with at least 32 characters
- `ALLOW_DEV_OTP_RESPONSE=false`
- Production `DATABASE_URL`
- Production FCM and Supabase values only in backend environment variables

Public frontend variables must not contain secrets.

## API Compatibility

No endpoint paths, request contracts, or response contracts were intentionally changed. Invalid oversized auth values now fail validation, which is a security hardening behavior.

## Remaining Security Work

- Add global request rate limiting for non-OTP endpoints.
- Add CI dependency auditing.
- Add security event alerts for repeated invalid QR scans, failed OTP bursts, and suspicious admin actions.
- Add admin audit-read endpoint review once backend audit explorer APIs are finalized.
- Consider httpOnly cookie auth for the admin panel before broader public admin rollout.
- Add signed upload URL flow and MIME/size validation before owner-driven file uploads are expanded.
