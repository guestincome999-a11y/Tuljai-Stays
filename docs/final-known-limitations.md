# Final Known Limitations

This document lists genuine remaining limitations for Tuljai Stays v1.0. It does not repeat completed work.

## Launch Blockers Before Public Go-Live

- Staging rehearsal must be completed with production-like data.
- Real-device QR scan testing must be completed for the owner app.
- Production support phone/email must be confirmed.
- Privacy policy and terms must be reviewed and published by the business/legal owner.
- Final app icons, splash assets, screenshots, and Play Store graphics must be provided.
- Production database migration baseline must be generated and applied safely.

## Technical Limitations

- Redis Socket.IO adapter is not configured; realtime is certified for a single backend instance.
- Global request rate limiting beyond OTP is documented but not implemented.
- Admin httpOnly cookie authentication is not implemented; admin currently uses client-side token storage.
- Full admin session inventory and remote revocation APIs are not implemented.
- Admin audit explorer read API is foundation-documented but not fully implemented.
- Export jobs and report delivery workers are not implemented.
- Infrastructure metrics such as CPU, memory, disk, and provider backup job status require external/provider instrumentation.
- Automated test framework is not configured; QA automation is documented as a future roadmap item.

## Business/Product Limitations

- Online payments are intentionally postponed.
- WhatsApp Business API integration is intentionally postponed.
- Email automation is not implemented.
- Revenue settlement workflows are foundation-level only.
- Advanced CRM and owner lifecycle management are not implemented.
- Multi-city expansion is architecturally prepared but Tuljapur-only for v1.
- Predictive demand forecasting and dynamic pricing are not implemented.
- Store/legal assets require final business sign-off.

## Mobile Release Limitations

- EAS build profiles and store build numbers are not configured.
- App Store/TestFlight readiness is documented but not executed.
- Push notification behavior still requires production credential and physical-device validation.
- Final icons, splash screens, notification icons, and feature graphics are missing.

## Dependency Audit Limitations

`npm audit --omit=dev --audit-level=high` reported moderate transitive advisories. Suggested automatic fixes require breaking major downgrades or incompatible package changes, so they were not applied in this final audit. Review and upgrade these dependency chains in a controlled maintenance release:

- Prisma dev tooling transitive `@hono/node-server`
- Next.js transitive `postcss`
- Expo/Firebase transitive `uuid`
