# Risk Register

| Risk                          | Probability | Impact   | Mitigation                                                  | Owner            | Status               |
| ----------------------------- | ----------- | -------- | ----------------------------------------------------------- | ---------------- | -------------------- |
| Backend overload              | Medium      | High     | Load testing, monitoring, booking pause, scale plan         | Technical owner  | Open                 |
| QR abuse                      | Low         | High     | Signed short-lived QR, single-use validation, scan logs     | Technical owner  | Mitigated foundation |
| Owner inactivity              | High        | High     | Owner training, response monitoring, support escalation     | Operations owner | Open                 |
| Database outage               | Low         | Critical | Backups, health checks, restore plan                        | Technical owner  | Open                 |
| Notification delays           | Medium      | Medium   | In-app/realtime fallback, delivery monitoring               | Technical owner  | Open                 |
| Render restart                | Medium      | Medium   | Health checks, reconnect handling, rollback plan            | Technical owner  | Open                 |
| Network failures              | High        | Medium   | Offline states, phone support, manual continuity            | Support owner    | Open                 |
| Festival surge                | High        | High     | Navratri manual, staffing, booking overload procedure       | Business owner   | Open                 |
| Wrong lodge arrival           | Medium      | Medium   | Clear booking details, support playbook, owner confirmation | Operations owner | Open                 |
| Incomplete store/legal assets | Medium      | High     | Launch asset checklist, legal review                        | Business owner   | Open                 |
