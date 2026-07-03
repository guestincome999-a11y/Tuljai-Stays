# Notifications, Realtime Events, and Announcements

Module 02 Sequence 05 adds backend notification persistence, FCM delivery logging, Socket.IO event publishing, admin announcements, and workflow triggers for booking, QR, check-in, checkout, and photo review events.

This sequence does not implement frontend screens, payments, analytics dashboards, WhatsApp, or settlement logic.

## Architecture

- `NotificationsService` stores in-app notifications and read/unread state.
- `NotificationDeliveryService` sends push notifications through FCM and records delivery attempts.
- `DeviceTargetingService` targets active device tokens.
- `NotificationTemplatesService` provides a template foundation for future message rendering.
- `NotificationEventsService` publishes safe workflow events from booking, QR, register, and photo services.
- `RealtimeEventsService` broadcasts Socket.IO events to private rooms.
- `AnnouncementsService` manages admin announcements and read tracking.

## Socket.IO

Namespace:

```text
/realtime
```

Authenticated sockets join:

- `user:{userId}`
- `role:{role}`

Server-side publishing supports:

- `user:{userId}`
- `role:ADMIN`
- `role:OWNER`
- `role:PILGRIM`
- `lodge:{lodgeId}`
- `city:{cityId}`
- `booking:{bookingId}`

Events added include:

- `notification:new`
- `notification:unread-count`
- `booking:new`
- `booking:accepted`
- `booking:rejected`
- `booking:expired`
- `qr:generated`
- `qr:scan-failed`
- `checkin:completed`
- `checkout:completed`
- `room:availability-updated`
- `announcement:new`
- `dashboard:update`
- `owner:alert`
- `system:error`

## FCM Behavior

- Push sends only to active device tokens.
- Business workflows do not fail if FCM fails.
- Every push attempt writes a `notification_delivery_logs` record.
- Invalid-token style provider failures deactivate the device token.
- High-priority booking alerts use high-priority Android/APNS delivery flags.

## Notification Triggers

| Workflow          | Recipients            | Events / Notifications                         |
| ----------------- | --------------------- | ---------------------------------------------- |
| Booking created   | Lodge owners, admin   | `booking:new`, `owner:alert`, dashboard update |
| Booking accepted  | Pilgrim               | `booking:accepted`                             |
| Booking rejected  | Pilgrim               | `booking:rejected`                             |
| Booking expired   | Pilgrim, admin        | `booking:expired`                              |
| QR generated      | Pilgrim               | `qr:generated`                                 |
| QR scan failed    | Scanner               | `qr:scan-failed`                               |
| Check-in complete | Pilgrim, lodge, admin | `checkin:completed`, dashboard update          |
| Checkout complete | Pilgrim, lodge, admin | `checkout:completed`, room availability update |
| Photo reviewed    | Lodge owners, admin   | `PHOTO_APPROVED` / `PHOTO_REJECTED`            |

Payloads are safe summaries only. Guest phone, address, government ID, and raw QR tokens are not broadcast.

## APIs

| Method   | Path                              | Auth  | Purpose                         |
| -------- | --------------------------------- | ----- | ------------------------------- |
| `GET`    | `/api/notifications`              | User  | List current user notifications |
| `GET`    | `/api/notifications/unread-count` | User  | Get unread count                |
| `POST`   | `/api/notifications/:id/read`     | User  | Mark notification read          |
| `POST`   | `/api/notifications/read-all`     | User  | Mark all read                   |
| `DELETE` | `/api/notifications/:id`          | User  | Soft delete notification        |
| `POST`   | `/api/admin/announcements`        | Admin | Create announcement             |
| `GET`    | `/api/announcements`              | User  | List visible announcements      |
| `POST`   | `/api/announcements/:id/read`     | User  | Mark announcement read          |
| `PATCH`  | `/api/admin/announcements/:id`    | Admin | Update announcement             |
| `DELETE` | `/api/admin/announcements/:id`    | Admin | Soft delete announcement        |

## Admin Announcements

Supported target audiences:

- `ALL`
- `PILGRIMS`
- `OWNERS`
- `ADMINS`
- `LODGE_SPECIFIC`
- `CITY_SPECIFIC`

Announcements publish immediately when active and inside the configured time window.

## Sensitive Data Rules

- Broadcast channels receive summary payloads only.
- User-specific notifications may include booking identifiers and safe status values.
- Push payloads do not include guest phone, address, government ID, or raw QR token.
- FCM tokens are never exposed by notification APIs.

## Retry Foundation

Failed FCM delivery attempts are stored. `NotificationDeliveryService.retryFailedNotifications()` provides the MVP retry hook for a future scheduled job or queue.

## Future WhatsApp Integration

`WHATSAPP_OPTIONAL` is modeled as a notification channel but not implemented. Future WhatsApp delivery can reuse notification persistence, templates, preferences, and delivery logs.
