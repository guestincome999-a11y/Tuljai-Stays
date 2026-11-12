# Testing and build report — checkpoint

Node 22.23.0, npm 10.9.8. Existing node_modules used; no installs/upgrades/source fixes. Audit date 2026-10-28.

| Command | Execution/result | Scope |
|---|---|---|
| npm run verify:workspace | passed, presence message | Directory existence only |
| npm run typecheck | completed; npm exit 2; typecheck.log | Backend fails against installed generated Prisma types; other workspace commands completed |
| npm run lint | completed; npm exit 1; lint.log | Pilgrim require/unsafe assignment errors and backend errors |
| npm run build | completed with backend failure; build.log | Admin compiled/generated pages; backend Nest build failed |
| npm exec --workspace @tuljai/backend -- prisma validate | passed, schema valid; prisma-validate.log | Local schema validation only; no live schema comparison |
| npm audit --omit=dev --json | completed; npm exit 1 | Registry advisory comparison; dependency-audit.json |

Earlier typecheck/lint sessions 18529/48497 became unavailable before final exit retrieval; their partial output cannot prove success. Repeated checks above persist output and are authoritative when finished. PowerShell wrapper exit can be zero even if npm fails; use explicitly printed npm exit value and log contents.

Dependency audit reports 48 package vulnerability entries: 2 critical, 27 high, 14 moderate, 5 low. These are package-level advisory results and dependency chains, not 48 reproduced exploits. next is marked direct/critical; shell-quote transitive/critical. Review detailed advisory URLs, affected installed versions, production reachability and compatible patches in dependency-audit.json before prioritizing updates. No automatic fix applied.

Backend security reviewer ran actual transpiled methods with synthetic inputs/in-memory stubs: owner report allowlist bypass, ADMIN role shortcut, non-admin-app OTP MFA gate, ownerLogin SUPER_ADMIN issuance without TOTP, and adminSetPassword SUPER_ADMIN target acceptance. Reviewer reports all probes exit 0; precise details belong in 13_SECURITY_AND_PRIVACY_AUDIT.md. These are isolated probes, not HTTP end-to-end or production exploitation.

Pending: final exits, Prisma validation, real isolated integration/concurrency/payment/QR tests, native-device rendering, full test-suite discovery. No production migrations, seeds, booking writes, charges or refunds executed. Build success alone must not be interpreted as workflow correctness.
