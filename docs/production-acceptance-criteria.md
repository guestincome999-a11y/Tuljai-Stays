# Production Acceptance Criteria

## Minimum Launch Criteria

- [ ] All critical flows pass.
- [ ] No critical security issues remain open.
- [ ] Backend build passes.
- [ ] Admin build passes.
- [ ] Mobile apps build successfully.
- [ ] QR flow passes on a real owner device.
- [ ] Booking flow passes end to end.
- [ ] Owner accept/reject passes.
- [ ] Emergency mode works.
- [ ] Feature flags work.
- [ ] Health check passes.
- [ ] Rollback plan exists.
- [ ] Backup plan exists.
- [ ] Support process is documented.
- [ ] Staging has been tested before production.

## Critical Flows

- Login and session restore
- Lodge discovery
- Booking request
- Owner booking decision
- Pilgrim QR display
- Owner QR scan
- Guest register creation
- Checkout
- Admin emergency controls
- Notifications and announcements

## Launch Decision

Production launch should be blocked by any issue that can cause booking loss, guest data exposure, QR check-in failure, owner inability to accept bookings, admin inability to pause operations, or production data corruption.
