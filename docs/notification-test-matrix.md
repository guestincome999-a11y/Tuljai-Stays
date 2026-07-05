# Notification Test Matrix

| Scenario                       | Preconditions                        | Steps                      | Expected Result                                          | Channels             | Pass/Fail |
| ------------------------------ | ------------------------------------ | -------------------------- | -------------------------------------------------------- | -------------------- | --------- |
| Booking created owner alert    | Owner has active lodge/device        | Pilgrim creates booking    | Owner receives in-app/realtime alert; push if enabled    | Socket, Push, In-app | Pending   |
| Booking accepted pilgrim alert | Pending booking                      | Owner accepts              | Pilgrim receives accepted alert                          | Socket, Push, In-app | Pending   |
| Booking rejected pilgrim alert | Pending booking                      | Owner rejects              | Pilgrim receives rejected alert                          | Socket, Push, In-app | Pending   |
| QR ready alert                 | Accepted booking                     | QR generated               | Pilgrim receives QR ready alert                          | Socket, Push, In-app | Pending   |
| Check-in completed alert       | Valid QR scan                        | Owner completes scan       | Pilgrim/owner state updates and notification is recorded | Socket, In-app       | Pending   |
| Checkout reminder              | Booking near checkout                | Scheduler/reminder runs    | Reminder notification created                            | Push, In-app         | Pending   |
| Emergency announcement         | Admin creates emergency announcement | Broadcast announcement     | Target users see emergency message                       | Socket, Push, In-app | Pending   |
| Festival announcement          | Festival announcement active         | Open apps                  | Announcement appears in configured surfaces              | In-app, Socket       | Pending   |
| Push denied                    | User denies push permission          | Register device            | App handles denied state gracefully                      | App UI               | Pending   |
| Push unavailable               | FCM not configured                   | Trigger notification       | Delivery failure is logged without blocking workflow     | Backend              | Pending   |
| Realtime disconnected          | Socket offline                       | Trigger notification event | REST refresh still shows notification                    | REST, App UI         | Pending   |
| Duplicate device token         | Same FCM token on new device         | Register token             | Older duplicate token deactivated if applicable          | Backend              | Pending   |
| Invalid device token           | FCM returns invalid token            | Send push                  | Delivery log records failure; token handling runs        | Backend, FCM         | Pending   |
| Notification read/unread       | Existing notification                | Mark one read              | Badge/count updates correctly                            | REST, App UI         | Pending   |
| Mark all read                  | Multiple unread notifications        | Mark all read              | All visible notifications become read                    | REST, App UI         | Pending   |
