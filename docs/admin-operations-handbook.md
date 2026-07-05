# Admin Operations Handbook

## Morning Checks

- Check System Health for backend, database, storage, realtime, QR, and notification status.
- Check Dashboard for pending bookings and owner online counts.
- Check Photo Review and Verification queues.
- Confirm feature flags and emergency controls are in normal state.

## During Booking Rush

- Keep Dashboard and Live Operations open.
- Watch pending booking count and owner response timers.
- Use Booking Control Center for manual interventions.
- Use Emergency Control only when operations leadership approves a pause or alert.

## Owner Not Responding Workflow

1. Open the booking detail.
2. Check owner response deadline.
3. Call owner from the support panel.
4. Call pilgrim if required and permitted.
5. Record the needed action when admin notes API is available.
6. Use manual accept/reject only with a clear reason.

## Booking Transfer Workflow Foundation

Transfer recommendations are shown as foundation cards. Actual transfer persistence requires backend transfer-option and transfer-action APIs.

## QR Failure Workflow

- Open QR Monitor.
- Filter by failed result.
- Check failure reason: expired, duplicate, invalid, wrong lodge, or unauthorized.
- For wrong lodge or suspicious use, open Security and Audit foundations.

## Guest Complaint Workflow Foundation

Support ticket and complaint APIs are not part of Module 05. Record external notes using the approved operations process until support modules are implemented.

## Emergency Announcement Workflow

1. Open Emergency Control.
2. Select reason and enter details.
3. Confirm emergency mode or booking pause if needed.
4. Send emergency announcement.
5. Monitor System Health and Live Operations.

## Festival Mode Workflow

1. Open Festival Control.
2. Enter reason.
3. Set festival banner/advisory/support messages.
4. Set start/end dates.
5. Enable Festival Mode.
6. Monitor booking pressure and QR success.

## End-Of-Day Checklist

- Review pending bookings and unresolved interventions.
- Review QR failures and notification failures.
- Check pending photos and lodge verification queue.
- Review revenue/booking summaries if permitted.
- Confirm emergency and maintenance modes are off unless approved.

## Register And Report Review

Owner register exports and admin exports are foundations. Use backend reports currently available for booking and commission summaries.
