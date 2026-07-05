# Admin Role Test Matrix

## Role Model Note

Backend persisted roles currently include `PILGRIM`, `OWNER`, `ADMIN`, and `SUPER_ADMIN`. The admin panel also defines operational permission personas for QA and UI access validation: `OPERATIONS_MANAGER`, `SUPPORT_EXECUTIVE`, `PHOTO_REVIEWER`, `FINANCE_ADMIN`, and `ANALYST`.

| Role                 | Login Allowed      | Visible Routes                                          | Hidden Routes                            | Allowed Actions              | Blocked Actions                           | Sensitive Data          | Export     | Settings     | Override | Finance | Security          | Pass/Fail |
| -------------------- | ------------------ | ------------------------------------------------------- | ---------------------------------------- | ---------------------------- | ----------------------------------------- | ----------------------- | ---------- | ------------ | -------- | ------- | ----------------- | --------- |
| `SUPER_ADMIN`        | Yes                | All                                                     | None                                     | All mapped actions           | None                                      | Full admin-visible data | Yes        | Yes          | Yes      | Yes     | Yes               | Pending   |
| `ADMIN`              | Yes                | Dashboard, operations, bookings, governance, monitoring | Finance-only and restricted exports      | Manage operational workflows | Super-admin-only and finance-only actions | Operational data        | Limited/No | Yes          | No       | No      | Limited           | Pending   |
| `OPERATIONS_MANAGER` | Yes if provisioned | Live ops, bookings, lodges, rooms, emergency            | Finance, analytics, audit, exports       | Operational queue work       | Finance/security/export mutations         | Operational only        | No         | Limited      | No       | No      | Emergency-limited | Pending   |
| `SUPPORT_EXECUTIVE`  | Yes if provisioned | Dashboard, bookings, support views                      | Finance, settings, governance management | Support booking workflows    | Overrides, settings, finance, security    | Masked where possible   | No         | No           | No       | No      | No                | Pending   |
| `PHOTO_REVIEWER`     | Yes if provisioned | Photo review, limited lodge context                     | Bookings, finance, security, settings    | Approve/reject photos        | Booking and finance actions               | No finance/security     | No         | No           | No       | No      | No                | Pending   |
| `FINANCE_ADMIN`      | Yes if provisioned | Revenue, reports, exports, finance settings             | Security and emergency controls          | View finance, export reports | Security and platform control             | Finance data            | Yes        | Finance only | No       | Yes     | No                | Pending   |
| `ANALYST`            | Yes if provisioned | Analytics, health, read-only dashboards                 | Mutating routes, exports, settings       | Read-only analytics          | All mutations                             | Aggregated only         | No         | No           | No       | No      | No                | Pending   |

## Validation Steps

1. Login with each role/persona.
2. Confirm sidebar visibility.
3. Try direct URL access to hidden routes.
4. Attempt one allowed action.
5. Attempt one blocked action.
6. Verify sensitive data masking expectations.
7. Confirm audit/security pages are limited to authorized roles.
