# QR Workflow Test Matrix

| Scenario                  | Preconditions                                | Steps                            | Expected Result                                        | Apps Involved           | Pass/Fail |
| ------------------------- | -------------------------------------------- | -------------------------------- | ------------------------------------------------------ | ----------------------- | --------- |
| Valid QR check-in         | Accepted booking with active QR              | Pilgrim displays QR; owner scans | Backend verifies QR, checks in guest, creates register | Pilgrim, Owner, Backend | Pending   |
| Expired QR                | QR token past expiry                         | Owner scans QR                   | Scan rejected as expired and logged                    | Owner, Backend          | Pending   |
| Used QR duplicate scan    | QR already used                              | Owner scans again                | Scan rejected as used and logged                       | Owner, Backend          | Pending   |
| Wrong lodge scan          | Owner not assigned to lodge                  | Wrong owner scans QR             | Scan rejected as wrong lodge/unauthorized              | Owner, Backend          | Pending   |
| Invalid payload           | Random non-QR payload                        | Owner scans/imports payload      | Invalid payload error and scan log                     | Owner, Backend          | Pending   |
| Tampered payload          | Signed payload modified                      | Owner scans tampered QR          | Signature verification fails                           | Owner, Backend          | Pending   |
| QR disabled feature flag  | QR flag disabled if supported in environment | Try QR flow                      | App/backend blocks or degrades according to config     | Admin, Pilgrim, Owner   | Pending   |
| Offline scan attempt      | Owner device offline                         | Scan QR                          | App shows offline state; no check-in created           | Owner                   | Pending   |
| Camera permission denied  | Camera permission blocked                    | Open scanner                     | Permission guidance shown                              | Owner                   | Pending   |
| QR refresh                | Active QR expires or refresh requested       | Pilgrim taps refresh             | New valid display payload shown                        | Pilgrim, Backend        | Pending   |
| Check-in register created | Valid QR scan                                | Complete scan                    | Guest register exists with expected booking data       | Owner, Backend          | Pending   |
| Guest details unlock      | Before and after valid scan                  | Compare owner visibility         | Details unlock only after verification                 | Owner, Backend          | Pending   |
| Checkout completes        | Checked-in register                          | Owner checks out                 | Booking/register/room status updates                   | Owner, Backend          | Pending   |
| Room status updates       | Check-in and checkout                        | Inspect room board               | Occupied/available or cleaning states update correctly | Owner, Backend          | Pending   |
