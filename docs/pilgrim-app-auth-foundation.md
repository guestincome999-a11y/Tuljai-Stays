# Pilgrim App Authentication Foundation

Module 03 Sequence 01 adds the Pilgrim App shell, Expo Router navigation, OTP login flow, secure session persistence, and connectivity foundation.

## App Structure

```text
apps/pilgrim-app/app/
  _layout.tsx
  index.tsx
  (auth)/
    _layout.tsx
    login.tsx
    verify-otp.tsx
  (app)/
    _layout.tsx
    home.tsx
    profile.tsx
```

## Auth Flow

1. App boots at `app/index.tsx`.
2. `AuthProvider` restores the persisted secure session.
3. Unauthenticated users are routed to `(auth)/login`.
4. Login calls `POST /api/auth/request-otp`.
5. Verify OTP calls `POST /api/auth/verify-otp`.
6. Tokens, user profile, and session metadata are persisted with `expo-secure-store`.
7. Authenticated users are routed to `(app)/home`.
8. Logout calls `POST /api/auth/logout` when possible, clears secure storage, and returns to login.

## Environment Variables

```text
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```

Use a LAN-accessible backend URL when testing on a physical device.

## Session Storage

Stored securely:

- Access token
- Refresh token
- User profile summary
- Backend session metadata
- Stable device ID

OTP codes are never stored.

## Connectivity

`@react-native-community/netinfo` powers a simple offline banner. OTP request and verification buttons are disabled while offline. Cached authenticated home/profile screens remain available while a session exists.

## Run

```bash
npm --workspace @tuljai/pilgrim-app run dev
```

## Known Limitations

- FCM token registration is not wired in this sequence.
- Token refresh is prepared but not attached to automatic 401 retry yet.
- Lodge browsing, booking, QR display, notifications UI, reviews, and announcements UI are intentionally deferred.

## Next Sequence

Module 03 Sequence 02 should implement lodge discovery, lodge details, room type listing, and booking lock creation in the Pilgrim App.
