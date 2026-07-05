# Admin Incident Response Guide

## Backend Down

- Open System Health and API Health.
- Confirm `/api/health` availability.
- Notify engineering with timestamp and visible error state.
- Use Emergency Control to publish a maintenance notice if approved.

## Database Unavailable

- System Health will show database critical if the health query fails.
- Pause booking creation only after operations approval.
- Notify engineering immediately.

## Notification Failure

- Open Notifications Monitor.
- Check failure count, invalid tokens, and recent failure reasons.
- Use announcements only after confirming delivery path health.

## QR Scan Failures Increasing

- Open QR Monitor.
- Filter by expired, invalid, duplicate, wrong lodge, and unauthorized.
- If wrong-lodge failures spike, notify operations and security.
- Consider QR disable only with leadership approval.

## Owner App Outage

- Check realtime owner count.
- Watch booking response timers.
- Use Booking Control Center for urgent manual actions.
- Broadcast owner announcement if the announcement path is healthy.

## Pilgrim App Outage

- Check API Health and public settings.
- Use Emergency Control for maintenance messaging if approved.
- Do not change force-update settings without a reason and confirmation.

## Wrong Lodge Check-In Issue

- Open QR Monitor and filter `WRONG_LODGE`.
- Confirm booking and lodge ids.
- Escalate to operations lead.
- Preserve audit context; do not reveal guest documents outside verified workflow.

## Fraud Or Suspicious Activity

- Open Security Center and Audit foundation.
- Record user, booking, lodge, and time externally until audit read endpoint exists.
- Revoke sessions when backend revoke endpoint is implemented.

## Emergency Crowd Advisory

- Open Emergency Control.
- Enter reason and details.
- Send emergency announcement.
- Enable emergency mode if approved.
- Monitor booking load and owner availability.

## Booking Pause Procedure

- Use Emergency Control.
- Provide reason/details.
- Confirm booking flag change.
- Document scope. City/lodge/room-type scoped pause requires backend support.

## Maintenance Mode Procedure

- Set maintenance messages.
- Enable maintenance mode only after approval.
- Verify public settings reflect the message.
- Disable after engineering confirms recovery.
