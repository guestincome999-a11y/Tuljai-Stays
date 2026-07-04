# Owner App Authentication Foundation

Module 04 Sequence 01 adds the first production-ready shell for the Tuljai Stays Owner App.

## Navigation Structure

- `apps/owner-app/app/index.tsx` bootstraps the secure session and routes owners.
- `apps/owner-app/app/(auth)/login.tsx` requests OTP for owner login.
- `apps/owner-app/app/(auth)/verify-otp.tsx` verifies OTP and creates the session.
- `apps/owner-app/app/(app)/dashboard.tsx` shows the assigned lodge shell.
- `apps/owner-app/app/(app)/bookings.tsx` is a placeholder for booking operations.
- `apps/owner-app/app/(app)/scan.tsx` is a placeholder for QR scanning.
- `apps/owner-app/app/(app)/rooms.tsx` is a placeholder for room management.
- `apps/owner-app/app/(app)/profile.tsx` shows owner profile and logout.

## Authentication Flow

- OTP request calls `POST /api/auth/request-otp`.
- OTP verification calls `POST /api/auth/verify-otp`.
- Logout calls `POST /api/auth/logout` when a refresh token is available.
- The owner app sends `appType: OWNER_APP` for OTP request and verification.
- Device identity is generated once and stored with Expo Secure Store.

## Role Validation

Allowed roles:

- `OWNER`
- `ADMIN`
- `SUPER_ADMIN`

If a user verifies OTP with only pilgrim access, the app clears the session and shows:

`This number is not registered as a lodge owner. Please contact Tuljai Stays admin.`

## Session Storage

Stored securely:

- access token
- refresh token
- user profile
- session details
- selected lodge ID
- selected lodge snapshot
- stable device ID

The app never stores OTP values.

## Assigned Lodge Loading

- Assigned lodges are loaded from `GET /api/owner/lodges`.
- One lodge is selected automatically.
- Multiple lodges are detected and the dashboard prepares a later selection UI.
- If no lodge is assigned, the dashboard shows a clear empty state.
- The last selected lodge is cached for offline shell viewing.

## Offline Behavior

- Network status is tracked with NetInfo.
- The top banner shows `You are offline`.
- First-time lodge loading requires internet.
- Cached selected lodge can be shown offline after a successful previous load.
- Booking, QR scanner, room management, and reports remain disabled or placeholder-only in this sequence.

## Environment Variables

Owner app uses:

```text
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Use a LAN IP for physical devices and the Render HTTPS API URL for production-like testing.

## Known Limitations

- Booking alerts are not implemented yet.
- QR scanner is not implemented yet.
- Room management is not implemented yet.
- Reports and register export are not implemented yet.
- Owner notifications and photo upload are not implemented yet.
- Multi-lodge switching UI is prepared but not interactive yet.

## Next Sequence Recommendation

Module 04 Sequence 02 should implement owner booking list, pending booking alerts, accept/reject actions, and realtime booking updates.
