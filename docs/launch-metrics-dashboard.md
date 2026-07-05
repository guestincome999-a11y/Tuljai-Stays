# Launch Metrics Dashboard

## Required KPIs

| KPI                      | Purpose                | Target/Alert                                   |
| ------------------------ | ---------------------- | ---------------------------------------------- |
| Bookings per hour        | Detect surge           | Alert on sudden spike beyond staffing capacity |
| Acceptance rate          | Owner responsiveness   | Investigate sustained drops                    |
| Owner response time      | Booking SLA            | Target under 2 minutes during festival         |
| QR success rate          | Check-in health        | Target 95% or better                           |
| Notification delivery    | Communication health   | Target 95% or better when FCM is enabled       |
| App crashes              | Mobile stability       | Investigate any repeated crash pattern         |
| API latency              | Backend health         | Alert on sustained high latency                |
| Database latency         | Data health            | Alert on slow queries or degraded health       |
| Occupancy                | Capacity management    | Use for availability and crowd planning        |
| Revenue estimate         | Business reporting     | Non-authoritative until payment module exists  |
| Admin intervention count | Operational friction   | Review high intervention days                  |
| Emergency incidents      | Safety and reliability | Review daily during festival                   |

## Dashboard Review Cadence

- Morning baseline review.
- Hourly during peak festival windows.
- Immediate review after incidents.
- End-of-day reporting.
