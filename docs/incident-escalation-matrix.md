# Incident Escalation Matrix

| Severity    | Examples                                                                               | Owner              | Response Time  | Escalation Path                                        | Communication                           | Recovery Target |
| ----------- | -------------------------------------------------------------------------------------- | ------------------ | -------------- | ------------------------------------------------------ | --------------------------------------- | --------------- |
| P1 Critical | Backend down, booking creation broken, QR check-in broken during peak, data exposure   | Incident commander | 5 minutes      | Technical owner -> Business owner -> External provider | Command center and approved user notice | 30 minutes      |
| P2 High     | Notification outage, admin panel unavailable, owner app login issue, database degraded | Technical owner    | 15 minutes     | Operations owner -> Incident commander                 | Internal channel and support brief      | 2 hours         |
| P3 Medium   | Individual booking stuck, owner not responding, single lodge issue                     | Operations owner   | 30 minutes     | Support owner -> Business owner if repeated            | Support channel                         | Same day        |
| P4 Low      | Copy issue, non-critical UI issue, delayed report                                      | Support owner      | 1 business day | Product/technical backlog                              | Internal ticket                         | Planned release |

## P1 Rules

- Open command center immediately.
- Pause risky workflows if needed.
- Assign one incident commander.
- Record timeline and decisions.
- Run post-incident review.
