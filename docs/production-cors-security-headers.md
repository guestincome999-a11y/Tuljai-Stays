# Production CORS and Security Headers

## Backend CORS

Production backend CORS must use explicit origins through `ALLOWED_ORIGINS`.

Example:

```text
ALLOWED_ORIGINS=https://admin.tuljaistays.com,https://tuljaistays.com
```

Rules:

- Never use wildcard CORS in production.
- Keep `ALLOW_DEV_OTP_RESPONSE=false`.
- Add only trusted admin or web origins.
- Native mobile apps do not rely on browser CORS, but API URLs must still use HTTPS.

## Backend Headers

The backend uses Helmet. In production, HSTS is enabled with subdomains and preload settings.

## Admin Panel Headers

The admin panel now sets foundational headers:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling camera, microphone, and geolocation for the admin panel
- `Content-Security-Policy-Report-Only` as a safe baseline for future tightening

The CSP is report-only to avoid breaking Next.js runtime behavior before production browser testing.
