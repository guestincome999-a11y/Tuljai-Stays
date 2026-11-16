-- Extend the existing gateway/ledger system without rewriting prior transactions or allocations.
ALTER TABLE commission_payments
  ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'FULL' CHECK (payment_type IN ('FULL','PARTIAL')),
  ADD COLUMN outstanding_before_paise BIGINT CHECK (outstanding_before_paise IS NULL OR outstanding_before_paise >= amount_paise),
  ADD COLUMN remaining_after_paise BIGINT CHECK (remaining_after_paise IS NULL OR remaining_after_paise >= 0);
-- NULL identifies legacy full-payment snapshots; their original due equals the allocated amount.
-- Existing immutable item rows are deliberately not updated.
ALTER TABLE commission_payment_items ADD COLUMN due_before_paise INTEGER
  CHECK (due_before_paise IS NULL OR due_before_paise >= amount_paise);
