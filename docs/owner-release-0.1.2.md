# Owner app 0.1.2 (Android build 25)

- Reports: original Tuljai report branding, PDF save/share, full booking pagination, custom date ranges and presets, inclusive IST dates, completed/all-booking selection, and themed report views.
- Dashboard quick actions: View Bookings, Scan QR, Room Availability, Lodge Profile. Manual booking remains available inside Room Availability.
- Booking search: camera button reads a booking pass and fills its booking code without navigating or checking in. The authenticated lookup supports signed v1 and encrypted v2 passes, including historical passes, and checks the owner's lodge access. Search queries all matching bookings, rather than only the currently loaded page.
- Android Back: normal navigation on other screens; the double-back exit prompt applies only on Home. Tab navigation keeps visit history.

The APK is a signed production build using the existing owner signing key and production Render API. It includes ARM64, 32-bit ARM, and x86_64 native libraries. No pilgrim APK is built for this release.

Verification includes owner UI/check-in/report tests, scanner lookup tests, Android back behavior tests, backend regressions, typechecks, lint, backend/admin production builds, and APK signature/version/ABI checks. Live camera use and complete account flows still require an owner login on a physical device.

Release APK: `outputs/Tuljai-Stays-Owner-0.1.2-Release.apk` (104,100,428 bytes).
SHA-256: `5226daaac59b4392ee8d5aa3969b5d0f6db4a0c78c649384095d8ff5586982b7`.
Android `assembleRelease` passed, including release lint. APK signing verifies with the same certificate as owner 0.1.1. Its packaged JavaScript bundle matches the fresh production bundle and contains the PDF export, QR search, updated quick actions, and Home exit prompt.
