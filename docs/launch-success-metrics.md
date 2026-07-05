# Launch Success Metrics

## Suggested Targets

These thresholds should be adjusted based on final infrastructure capability and staging results.

| Metric                     | Target                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| Booking completion         | 99% of valid booking requests complete without technical failure |
| QR success                 | 95% successful scans for valid active QR passes                  |
| Notification delivery      | 95% delivery when production FCM is configured                   |
| Owner response             | Median response under 2 minutes during peak                      |
| API uptime                 | Greater than 99% during launch window                            |
| Critical incident recovery | P1 recovered or mitigated within 30 minutes                      |
| Admin access               | 100% of launch admins can login before launch                    |
| Health checks              | Backend health remains `ok` outside declared provider incidents  |

## Launch Is Successful When

- No unresolved P1 incidents remain.
- Booking and QR workflows work on real devices.
- Support queue is manageable.
- Owners respond within expected windows.
- Operations team completes end-of-day review.
