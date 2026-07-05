# Admin Platform Control Center

Module 05 Sequence 05 adds remote configuration and platform controls for Tuljai Stays.

## Implemented Routes

- `/admin/settings`
- `/admin/feature-flags`
- `/admin/festival-control`
- `/admin/emergency-control`
- `/admin/announcements`

## Settings Center

The settings center uses:

- `GET /api/admin/settings`
- `PATCH /api/admin/settings/:key`
- `GET /api/settings/public`

Settings are grouped by booking, QR, commission, notifications, app configuration, maintenance, support, and multi-city categories. Critical settings require a reason and confirmation before saving.

## Feature Flags Center

The feature flags center uses:

- `GET /api/admin/feature-flags`
- `PATCH /api/admin/feature-flags/:key`

Flags include WhatsApp, online payments, festival mode, QR check-in, booking enabled, app availability, emergency mode, and maintenance mode. Rollout percentages are captured as a foundation for future app-side rollout adoption.

## Festival Control

Festival control uses public settings plus the `festival_mode` feature flag. It manages festival banner text, announcement text, temple advisory text, crowd warning text, festival support instructions, start/end date foundation, and UI color foundation.

No festival dates are hardcoded.

## Emergency Control

Emergency control uses feature flags and public settings for:

- Booking pause via `booking_enabled`
- Emergency mode via `emergency_mode`
- Maintenance mode via `maintenance_mode`
- QR check-in availability via `qr_checkin_enabled`
- Emergency banner and maintenance messages
- Emergency announcement broadcast

Every critical action requires confirmation and reason details in the UI.

## Announcement Broadcasting

The announcement center uses:

- `POST /api/admin/announcements`
- `GET /api/announcements`
- `PATCH /api/admin/announcements/:id`
- `DELETE /api/admin/announcements/:id`

Admins can broadcast general, emergency, temple, festival, maintenance, offer, and system announcements to all users, pilgrims, owners, admins, city-specific targets, or lodge-specific targets.

## Commission Foundation

The `default_commission_amount` setting is managed from the settings center and requires finance permission in the UI. Per-lodge, festival, promotional, and effective-date commission models are documented as future backend work.

## WhatsApp And Payment Toggles

WhatsApp and online payment toggles are implemented as settings and feature flags only. Provider delivery and gateway logic are intentionally not implemented in this sequence.

## Audit Safety

Settings and feature flag updates use backend audit logging. The admin UI also requires confirmation and reason text for dangerous changes such as booking pause, emergency mode, maintenance mode, force update, payment, WhatsApp, commission, QR, and app availability controls.

## Known Limitations

- Scoped booking pause for city, lodge, and room type requires a backend pause model.
- Per-lodge and festival commission require backend commission models.
- Rollout percentage requires app-side adoption to affect user cohorts.
- WhatsApp and payment toggles do not implement providers.
- Emergency mode depends on apps reading public settings and feature flags.
- Audit visibility remains limited until a richer admin audit endpoint is exposed.

## Next Sequence Recommendation

Module 05 Sequence 06 should focus on admin final QA, release readiness, accessibility hardening, and any missing backend support required by the platform control center.
