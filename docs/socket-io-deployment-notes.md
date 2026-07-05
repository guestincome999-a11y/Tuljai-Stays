# Socket.IO Deployment Notes

## Current Deployment Mode

Tuljai Stays realtime currently works on a single backend instance. Clients authenticate using JWTs and connect to the `realtime` namespace.

Used workflows:

- Booking updates
- Owner booking alerts
- QR events
- Room availability changes
- Admin announcements

## Single Instance

No extra adapter is required for one backend instance. Render can run this as a normal web service.

## Multiple Instances

Before scaling backend horizontally:

- Add a Redis Socket.IO adapter.
- Use shared Redis credentials through environment variables.
- Confirm room events reach clients connected to different backend instances.
- Review sticky session requirements for the chosen hosting setup.

## Reconnect Behavior

Mobile and admin clients should expect reconnects during deploys or network changes. Clients already establish fresh realtime connections using the current access token.

## Production Limitation

Without Redis, realtime events are instance-local. Horizontal scaling should wait until Redis adapter support is added and tested.
