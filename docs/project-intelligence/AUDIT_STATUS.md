# Audit status

Audit began 2026-10-27 Asia/Calcutta; resumed 2026-10-28. Completion: pending.

- Repository: D:/Tuljai-Stays; branch main; audited HEAD ac78961b94f3c6dbcb15ba98fc5314d5d93186df.
- Initial and resumed working trees clean; staged, unstaged and untracked changes absent before audit documentation.
- Local origin/main matches HEAD, but remote freshness is not established by that fact.
- Node v22.23.0, npm 10.9.8; manifest requests npm 10.8.0. Existing dependencies used; none installed or upgraded.
- rtk required by user instructions was unavailable on PATH and common install locations; direct read-only shell fallback disclosed.
- Three parallel reviewers initially failed due to usage limit, then resumed on 2026-10-28. Their assigned source reviews cover applications/realtime, backend/security, booking/payments.
- Supabase project heypsutewmttbscuwqje was accessible on 2026-10-27, PostgreSQL 17 (reported version 17.6.1.141). Public relation ACL query showed RLS disabled but anon SELECT/INSERT/UPDATE/DELETE and authenticated SELECT denied. This does not establish every privilege or function is safe. No private record contents retrieved.
- Supabase advisors: six mutable function search paths; leaked password protection disabled. Schema/migration checksum comparison and data-integrity aggregates remain pending.
- Render workspace My Workspace (tea-d9hk3e58nd3s73d746i0) explicitly selected by user on resumption. Both services list live commit 8ccc63076fb39f94db8575f1663e77cea21db2d6, newer/different from local audited HEAD; ancestry comparison pending.
- Workspace presence check passed. Typecheck session 18529 and lint session 48497 started; final results must be recorded before claiming success.
- No application source edits, database mutations, payment operations, deployments, dependency upgrades, branch switches or Git history modifications authorized or performed.

## Remaining work

Finish detailed source reviews and consolidate their reports; inspect deployed commit differences; collect full live schema, constraints, triggers, policies and migration checksums; finish build/lint/typecheck and dependency audit; inspect production health/logs; complete numbered reports, issue register, environment catalog, diagrams and executive handover. Real-device and isolated payment/concurrency tests remain unexecuted. Do not label this audit complete until these gaps are resolved or explicitly documented as inaccessible.

## Resume checkpoint additions

- Live metadata saved: live-schema-metadata.json (721 columns, 233 constraints, 277 indexes, nine trigger entries, 27 migration records). See 07_DATABASE_ARCHITECTURE.md.
- Migration comparison: 21 normalized checksums match; five existing files differ; one applied migration is missing locally. Raw CRLF differences were separated from LF-normalized results; see 08_DATABASE_DRIFT_REPORT.md.
- npm typecheck completed with npm exit 2, backend generated Prisma type errors. Stale generated client is a hypothesis, not yet verified. No client regeneration performed yet.
- npm audit --omit=dev --json completed npm exit 1: 48 package vulnerability entries (2 critical/27 high/14 moderate/5 low); advisory reachability is not yet verified. No updates applied.
- Lint session 70863 and build session 58925 remain running at this checkpoint; persistent logs available. Admin build compiled and generated pages in progress. Earlier session IDs are obsolete.
- Render user selection resolved. Live revision is absent from local Git objects; remote/deployed-source comparison still pending.

Last update: 2026-10-28 Asia/Calcutta.

Final validation checkpoint: lint completed npm exit 1; root build failed in backend after admin compilation; Prisma validate passed. See 18_TESTING_AND_BUILD_REPORT.md and persistent logs. Parallel reviewer state reported pending_init on final inspection; assigned detailed files are not yet saved. Their communicated findings are preserved in 20_MASTER_ISSUE_REGISTER.md and must be consolidated before audit completion. Application source tracked diff remains empty; only audit directory is untracked.
