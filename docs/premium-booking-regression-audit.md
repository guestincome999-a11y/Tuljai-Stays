# Premium merge regression comparison — 9 November 2026

Compared the current premium screens with their pre-merge snapshots in `.codex-temp/premium-merge`, the premium source worktree, and the shared Git base. Findings below are source review and automated-test results; they do not imply live authenticated or physical-device coverage.

| Area | Finding and disposition |
| --- | --- |
| Booking list | Premium source gated the entire pass action with QR eligibility. Confirmed bookings now retain View Details and View Pass even when QR is temporarily unavailable, payment metadata is stale or the client date check fails. Navigation always carries the selected booking ID. |
| Booking detail | Restored pass entry independently of live QR eligibility. |
| Lodge contact | Premium merge accidentally coupled authorized call/WhatsApp controls to QR eligibility. Restored the existing confirmed-status guard and protected endpoint response; pending/history contacts remain hidden. |
| Booking load errors | Prevented failed refreshes from also rendering a misleading empty-bookings state; Retry remains visible. |
| Live QR and exports | Existing status/payment/date checks, signed payload identity/expiry, immediate reauthorization before export and single-use restrictions remain unchanged. Access to a pass summary does not authorize a QR credential. |
| Confirmation actions | Get Pass, View Booking/Home, retry payment and pending approval branches remain present. |
| Checkout | Current authoritative quotes, prepaid hold/payment recovery and synchronous double-tap guards remain; premium presentation retained. |
| Browse/home | Summary prices, six-item server pagination, latest-request protection, cancellation and separate loading/error states retained; browse and gallery remain virtualized. |
| Lodge detail | Real gallery, live availability, room selection, reviews and directions retained. |
| Profile/settings/auth | Existing routes/preferences, OTP/Google flows and long-session startup restoration retained; no backend authentication rule changed. |
| QR selection | Explicit cancelled/missing booking links do not fall back to another stay; original fallback would have shown an unrelated pass. Kept the safer premium fix. |

Automated verification: 30 Pilgrim tests pass, including actual booking-list rendering at 360 and 420 width, exact pass destination, QR-versus-pass eligibility and error-versus-empty presentation. TypeScript/lint/build statuses are recorded in `performance-booking-actions-*` logs. No production data, credentials, payment backend, owner acceptance or QR verification was changed.

Corrected release: 0.2.1 / build 44. Stable APK path: `.codex-temp/apks/Tuljai-Stays-Premium-0.2.1-Android.apk`. Native runtime is aligned to the patch version so the older runtime bundle cannot be mistaken for this fix.

Compatibility-path comparison also found the same over-restrictive pass-button condition in the alternate v2 BookingCard. Restored accepted/QR-generated pass navigation there, fixed corrupted arrow/separator text and import ordering, and corrected v2 QR gallery saving to use the SDK 57 legacy MediaLibrary entry. The active Expo route still renders PilgrimBookingsScreen.

Final validation: all 30 Pilgrim tests pass; TypeScript and full-app ESLint pass. Release build passed (27 minutes on this host). SDK aapt confirms version 0.2.1 / code 44 / minimum Android API 24 and ARM64, 32-bit ARM and x86_64 support. ZIP inspection confirms libreactnative.so and libappmodules.so for each ABI. APK size: 108433003 bytes; SHA-256: `0315a2e558a0f378ee444ef7de1588be674b745dcc0676c725d343eede0f83e7`. Live signed-in and physical-phone booking verification remains unexecuted. No commits or pushes were made.
