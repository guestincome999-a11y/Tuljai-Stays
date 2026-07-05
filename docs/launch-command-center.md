# Launch Command Center

## Purpose

The launch command center coordinates technical deployment, operations, lodge owner support, customer support, and business decisions during the first production launch and festival periods.

## Launch Timeline

| Timeframe             | Action                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| T-7 days              | Confirm staging QA, support contacts, owner readiness, backup/rollback plan, and final environment variables. |
| T-3 days              | Freeze non-critical changes, confirm launch roles, rehearse QR and booking workflows.                         |
| T-1 day               | Verify production health, backups, admin accounts, feature flags, emergency mode, and support scripts.        |
| Launch day morning    | Run go-live checklist, open command center, confirm owners and admins online.                                 |
| Launch day peak hours | Monitor bookings, owner response, QR scans, notifications, API health, and support queue.                     |
| Launch day evening    | Review incidents, unresolved bookings, checkouts, reports, and next-day actions.                              |

## Owners

| Role               | Responsibility                                                 | Assigned Person |
| ------------------ | -------------------------------------------------------------- | --------------- |
| Technical owner    | Deployment, backend/admin health, database, rollback execution | `<name>`        |
| Operations owner   | Booking flow, owner readiness, admin coordination              | `<name>`        |
| Business owner     | Launch decision, customer commitments, external communication  | `<name>`        |
| Support owner      | Pilgrim and owner support queue                                | `<name>`        |
| Incident commander | P1/P2 coordination and final escalation decisions              | `<name>`        |

## Emergency Contacts

- Technical emergency: `<contact>`
- Operations emergency: `<contact>`
- Business emergency: `<contact>`
- Support emergency: `<contact>`
- Hosting/provider contact: `<contact>`

Do not commit personal phone numbers unless approved.

## Deployment Order

1. PostgreSQL backup verified.
2. Database migrations applied.
3. Backend deployed.
4. Backend health check passed.
5. Admin panel deployed.
6. Admin login verified.
7. Mobile production API configuration verified.
8. QR and booking smoke tests completed.

## Rollback Authority

Rollback can be authorized by:

- Technical owner for confirmed deployment failure.
- Business owner for customer-impacting launch risk.
- Incident commander during P1 incidents.

## Support Escalation

| Issue                | First Response   | Escalate To        |
| -------------------- | ---------------- | ------------------ |
| Booking issue        | Support owner    | Operations owner   |
| QR scan issue        | Owner support    | Technical owner    |
| Backend outage       | Technical owner  | Incident commander |
| Owner not responding | Operations owner | Business owner     |
| Public communication | Support owner    | Business owner     |

## Launch Communication Plan

- Internal launch channel for admins and operators.
- Owner broadcast for start of launch day.
- Support script for common pilgrim questions.
- Emergency announcement only for user-impacting incidents.
- End-of-day summary to business and operations owners.

## Decision Matrix

| Condition                                            | Decision                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Health checks fail before launch                     | Hold launch.                                                                 |
| QR scan fails on real device                         | Hold launch for QR-dependent rollout.                                        |
| Booking creation fails                               | Hold launch.                                                                 |
| Push notifications fail but in-app and realtime work | Launch may proceed with support note.                                        |
| Owner availability is low                            | Launch only with reduced lodge availability or manual support.               |
| P1 incident during launch                            | Pause risky workflows, communicate, and execute rollback or continuity plan. |
