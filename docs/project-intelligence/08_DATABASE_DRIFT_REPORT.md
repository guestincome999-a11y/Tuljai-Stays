# Database drift report — verified checkpoint

Read-only query of public._prisma_migrations returned 27 records, all finished and none rolled back. Local migration directory contains 26 matching records and lacks 20260819000000_fix_commission_effective_date_and_backfill.

Raw local hashes initially mismatched every record because the Windows working files use CRLF while Git index uses LF. This is not evidence of semantic drift. After normalizing CRLF to LF, 21 records matched and five existing files still differed:

- 20260816000000_lodge_commission_accounting
- 20260825120000_drop_duplicate_online_payment_sync_trigger
- 20261010120000_commission_ledger_single_source
- 20261010150000_pay_at_lodge_commission_on_checkin
- 20261010170000_void_test_booking_commission

Evidence: live-schema-metadata.json, local-migration-checksums.json, migration-comparison.json (raw bytes), migration-comparison-lf.json (normalized). Verified history discrepancies; schema-effect differences and causes remain unverified. Other whitespace, edits after application, manual baselines and historical versions require investigation. Do not infer corruption or repair migration history based on hashes alone.

Next: recover missing migration from Git history or deployment artifact; compare each mismatch with applied historical SQL and current live function/trigger/view definitions. Check local schema against live column/constraint catalog. No migrations, baseline resolves, checksum edits, resets or schema changes performed.
