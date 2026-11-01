# Persistent authentication sessions

Pilgrim, Owner and Admin use a fixed maximum lifetime anchored to the original login:

```dotenv
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=180d
AUTH_SESSION_MAX_AGE_DAYS=180
```

The new variable names take precedence over the legacy `JWT_ACCESS_TOKEN_TTL` and
`JWT_REFRESH_TOKEN_TTL` aliases. Set these explicitly in deployed environments;
an existing legacy `30d` override still applies if the new variable is absent.
Values support positive integer seconds or integer `s`, `m`, `h`, `d` durations.

`UserSession.sessionExpiresAt` is written once at login. Refresh checks the opaque
refresh token's SHA-256 hash, device binding, token expiry/revocation, session
activity/deadline and account activity/deletion. Refresh does not rotate tokens or
change either expiry. Access JWTs identify their refresh-token record with `sid`;
authenticated requests check the database so logout and account disabling take
effect without waiting for the JWT to expire. Access JWT expiry is capped at the
session deadline. There is no inactivity timeout or inactivity cleanup.

Native apps retain credentials and device identity in Expo SecureStore across
process restarts and reboots. Startup refreshes saved sessions; protected HTTP
requests retry once after a 401 with a refreshed access token. Concurrent refresh
requests are coalesced. Network/server failures retain stored credentials for a
later retry; a definitive refresh 401 requires login. Saved session deadlines are
also checked locally on startup, so returning after 180 days requires login even
when offline. Native web previews use
persistent browser local storage and should be treated as previews.

Admin keeps the refresh credential in a persistent `HttpOnly`, `SameSite=Strict`
cookie (`Secure` in production), restricted to `/api/auth-session`. Browser
storage contains the short-lived access token, profile/session metadata and a
cookie marker, never the actual refresh credential. The same-origin Next.js route
refreshes and revokes sessions with the backend. Refresh does not rewrite the
cookie's original expiration. Production Admin must run with HTTPS and Next.js
server routes enabled. Temporary outages preserve the cookie. Explicit logout
must succeed against the backend before credentials are discarded; callers can
retry when offline.

## Deployment

1. Deploy migration `20261101000000_fixed_auth_session_lifetime` before the updated
   backend starts (`npm run db:deploy`). Regenerate Prisma Client during the build.
2. Configure the three variables above on the backend and restart it. Configure
   Admin's `API_BASE_URL` or `NEXT_PUBLIC_API_BASE_URL` to the same backend, and
   `ADMIN_PUBLIC_ORIGIN` to its public HTTPS origin.
3. Deploy the Admin and mobile clients.

The migration backfills existing session deadlines from `created_at + 180 days`.
It upgrades still-valid, active refresh credentials to that fixed deadline.
Expired old 30-day credentials and revoked/inactive sessions are not resurrected;
those users need a fresh login. Legacy
access JWTs without `sid` are rejected; updated clients recover using a valid
stored refresh credential. Admin sessions previously held only in sessionStorage
require one fresh login to establish the persistent cookie.

## Verification

Run `npm run test:auth --workspace @tuljai/backend`.

The clock-controlled tests exercise real OTP/password login, JWT signing and
verification, refresh/logout, and the real mobile token/session stores and HTTP
401 retry code. OS SecureStore and Prisma/HTTP boundaries are simulated. Pilgrim
and Owner are tested independently after 15 minutes and process recreation on
days 7, 90, 179 and 181. Separate tests verify exact deadline enforcement,
revocation, disabled accounts, inactive sessions and device binding for all three
app types. Admin route tests verify persistent cookie expiry/security flags,
refresh without sliding expiry, CSRF rejection, temporary failures and logout.
These are automated lifecycle simulations, not physical-device reboot tests or
tests against a deployed database.
