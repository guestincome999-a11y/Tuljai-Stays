# QA Automation Foundation

## Current State

No dedicated automated test framework is configured in the monorepo yet. This sequence does not add a framework because the objective is production QA validation and release readiness documentation, not new testing infrastructure.

## Recommended Future Automation

## Backend API Smoke Tests

- Health endpoint
- OTP request and verify with test provider
- Role-protected route rejection
- Lodge discovery
- Booking create
- Owner accept/reject
- QR payload fetch
- QR scan success and failure
- Settings and feature flags

Recommended tools: Jest or Vitest with Supertest-compatible HTTP calls.

## Admin Route Smoke Tests

- Login page renders.
- Protected routes redirect when unauthenticated.
- Dashboard loads after authenticated session mock.
- Permission gates hide blocked actions.
- Critical pages render at desktop and mobile widths.

Recommended tools: Playwright after staging URLs are available.

## Mobile Critical Flow Tests

- Pilgrim login
- Lodge discovery
- Booking request
- QR display
- Owner login
- Owner dashboard
- QR scanner permission state
- Register checkout

Recommended tools: Expo-compatible end-to-end testing or Detox after native build setup is finalized.

## QR Integration Tests

- Valid QR payload
- Expired QR payload
- Used QR payload
- Tampered payload
- Wrong lodge scan
- Offline scan behavior

## Adoption Plan

1. Start with backend smoke tests because they are fastest and most stable.
2. Add admin Playwright smoke tests after staging deployment exists.
3. Add mobile device tests after EAS build setup.
4. Run smoke tests in CI before release tags.
