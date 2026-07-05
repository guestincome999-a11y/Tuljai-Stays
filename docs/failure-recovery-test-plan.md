# Failure Recovery Test Plan

| Failure                 | Test Method                                 | Expected Result                                            | Pass/Fail |
| ----------------------- | ------------------------------------------- | ---------------------------------------------------------- | --------- |
| Backend unavailable     | Stop backend or point client to invalid URL | Apps show recoverable error; no data corruption            | Pending   |
| Database unavailable    | Use staging DB outage simulation            | Health becomes degraded; requests fail safely              | Pending   |
| Socket disconnected     | Disable network or block socket             | REST refresh still provides current state                  | Pending   |
| Notification failure    | Disable FCM config in staging               | Workflow succeeds; delivery failure is logged              | Pending   |
| QR scan failure         | Scan invalid/tampered QR                    | User-safe rejection and scan log                           | Pending   |
| Booking API timeout     | Simulate slow API                           | App shows loading timeout/error without duplicate booking  | Pending   |
| Image load failure      | Use broken photo URL                        | Fallback UI appears                                        | Pending   |
| Admin permission denied | Access blocked route/action                 | Permission denied state shown; no mutation occurs          | Pending   |
| Expired token           | Use expired access token                    | Refresh or login redirect works                            | Pending   |
| Render restart          | Restart staging service                     | Apps reconnect and recover                                 | Pending   |
| Partial service outage  | Disable storage or FCM only                 | Core booking/QR workflows remain unaffected where possible | Pending   |
| Storage unavailable     | Remove Supabase config in staging           | Upload/storage-dependent paths fail gracefully             | Pending   |

## Recovery Evidence

Capture screenshots, backend logs, audit records, and timestamps for each failure test.
