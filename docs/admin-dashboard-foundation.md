# Admin Dashboard Foundation

## Scope

Module 05 Sequence 01 adds the secure foundation for the Tuljai Stays Admin Dashboard. It does not implement live operations, lodge control, booking control, advanced reports, analytics, support center, monitoring, payments, settlements, or WhatsApp delivery.

## Admin Auth Flow

1. Admin opens `/login`.
2. Admin requests OTP using:
   - `POST /api/auth/request-otp`
   - Payload uses `appType: ADMIN_PANEL` and `purpose: LOGIN`.
3. Admin verifies OTP using:
   - `POST /api/auth/verify-otp`
   - Payload includes browser device ID, `deviceName: Admin Browser`, and `platform: WEB`.
4. The admin panel validates returned roles.
5. Users without admin permissions see:
   - `This account does not have permission to access the Tuljai Stays Admin Panel.`
6. Protected routes validate existing session through:
   - `GET /api/auth/me`
7. Logout calls:
   - `POST /api/auth/logout`

## Session Storage

The current backend returns access and refresh tokens to the client. The admin panel stores tokens and session metadata in browser `sessionStorage`, not `localStorage`, so the session is scoped to the browser tab lifecycle.

Security limitation: httpOnly cookie auth is not implemented yet. The admin panel is structured so a later auth sequence can migrate token handling to httpOnly cookies without changing protected page structure.

Stored session data includes:

- Access token
- Refresh token
- Active session metadata
- User profile
- Roles
- Derived permissions

Rules implemented:

- Tokens are not logged.
- Tokens are not placed in URLs.
- Session is cleared on logout.
- Session is cleared on invalid token/session validation failure.
- Non-admin users are rejected and session data is cleared.

## Permission Model

The frontend permission framework supports:

- `SUPER_ADMIN`
- `ADMIN`
- `OPERATIONS_MANAGER`
- `SUPPORT_EXECUTIVE`
- `PHOTO_REVIEWER`
- `FINANCE_ADMIN`
- `ANALYST`

Backend currently exposes `ADMIN` and `SUPER_ADMIN` through shared `UserRole`. Additional admin roles are frontend-ready for later backend persistence.

Permission groups:

- `dashboard.view`
- `operations.view`
- `lodges.view`
- `lodges.manage`
- `owners.view`
- `owners.manage`
- `bookings.view`
- `bookings.manage`
- `bookings.override`
- `rooms.view`
- `rooms.manage`
- `photos.review`
- `announcements.manage`
- `settings.manage`
- `feature_flags.manage`
- `reports.view`
- `reports.export`
- `analytics.view`
- `audit_logs.view`
- `security.manage`
- `support.view`
- `support.manage`
- `finance.view`
- `finance.manage`
- `system_health.view`

`SUPER_ADMIN` receives all permissions. Navigation is filtered by permission, and future pages can reuse the same `PermissionGate`.

## Protected Routing

Protected routes live under `/admin`.

Implemented routes:

- `/admin/dashboard`
- `/admin/account`
- `/admin/audit`

Unauthenticated users are redirected to `/login`. Authenticated users without admin permissions see the access denied state and can logout safely. The admin shell does not render protected UI before session validation completes.

## Layout Structure

The admin shell includes:

- Sidebar
- Topbar
- Page title area
- User menu link
- Logout action
- Environment badge
- Notification placeholder
- Search placeholder
- Breadcrumb foundation
- Responsive collapse for smaller screens

Sidebar sections are permission-aware and include placeholders for later sequences:

- Dashboard
- Live Operations
- Bookings
- Lodges
- Owners
- Rooms
- Photo Review
- Announcements
- Reports
- Analytics
- Support
- System Health
- Security
- Audit Logs
- Settings
- Feature Flags

Placeholder links route safely to the dashboard until their feature pages are implemented.

## Audit Foundation

Backend services create audit logs internally, but a public admin audit endpoint is not currently available.

The audit page is protected by:

- `audit_logs.view`

Expected future API:

- `GET /api/admin/audit-logs`

The page intentionally does not fake audit rows.

## Environment Variables

Admin panel requires:

```bash
NEXT_PUBLIC_API_BASE_URL=
```

For local development, this can point to the local backend URL. For production, it should point to the Render backend URL. No localhost URL is hardcoded in admin source code.

## Security Notes

- Admin routes are guarded client-side in this sequence because backend token storage currently returns client-managed JWTs.
- httpOnly cookie auth should be added in a future security hardening sequence.
- Critical admin actions in later modules must create audit logs.
- Backend stack traces and token values are not shown in UI.
- Session expired states show safe generic copy.

## Known Limitations

- httpOnly cookie auth is not yet implemented.
- Some admin roles are frontend-ready but not backend-persisted yet.
- Audit log API is a protected shell until `GET /api/admin/audit-logs` exists.
- Sidebar routes beyond dashboard, account, and audit are placeholders for later sequences.
- Refresh-token rotation is not wired into the admin client yet.

## Next Sequence Recommendation

Module 05 Sequence 02 should implement the live operations dashboard using existing backend summary, presence, booking, notification, room, and realtime APIs.
