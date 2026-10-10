-- Test bookings (e.g. Rs 1 stays carrying Rs 1000 commission) must not appear as money owed.
-- Entries are voided, not deleted: the original amount and a reason stay on the ledger row for audit.
UPDATE "lodge_commission_ledger" l
SET "status" = 'VOIDED',
    "voided_at" = CURRENT_TIMESTAMP,
    "updated_at" = CURRENT_TIMESTAMP,
    "notes" = COALESCE(l."notes" || ' | ', '')
              || 'Voided as test data: booking amount Rs ' || l."base_amount"::text
              || ' is below the commission of Rs ' || l."commission_amount"::text || '.'
WHERE l."status" = 'OUTSTANDING'
  AND l."commission_amount" > l."base_amount"
  AND NOT EXISTS (
    SELECT 1 FROM "lodge_commission_settlement_allocations" a WHERE a."ledger_id" = l."id"
  );

-- Keep the booking rows consistent with the ledger so estimates and reports show the same figures.
UPDATE "bookings" b
SET "commission_amount" = NULL,
    "commission_rate_percent" = NULL,
    "commission_fixed_amount" = 0,
    "commission_type" = 'PERCENTAGE',
    "commission_enabled_snapshot" = false
FROM "lodge_commission_ledger" l
WHERE l."booking_id" = b."id"
  AND l."status" = 'VOIDED'
  AND l."notes" LIKE '%Voided as test data:%';

-- Reconciliation now also flags any future entry where commission exceeds the booking amount.
CREATE OR REPLACE VIEW public.lodge_commission_reconciliation AS
SELECT
  lo.id AS lodge_id,
  lo.name AS lodge_name,
  COALESCE((SELECT COUNT(*) FROM bookings b
            WHERE b.lodge_id = lo.id AND b.deleted_at IS NULL AND b.commission_amount > 0
              AND public.tuljai_commission_is_eligible(b.status::text, b.payment_status::text)
              AND NOT EXISTS (SELECT 1 FROM lodge_commission_ledger l WHERE l.booking_id = b.id)), 0) AS missing_entries,
  COALESCE((SELECT COUNT(*) FROM lodge_commission_ledger l JOIN bookings b ON b.id = l.booking_id
            WHERE l.lodge_id = lo.id AND l.status = 'OUTSTANDING'
              AND (b.deleted_at IS NOT NULL
                   OR NOT public.tuljai_commission_is_eligible(b.status::text, b.payment_status::text))), 0) AS stale_entries,
  COALESCE((SELECT COUNT(*) FROM lodge_commission_ledger l JOIN bookings b ON b.id = l.booking_id
            WHERE l.lodge_id = lo.id AND l.status <> 'VOIDED'
              AND ABS(l.commission_amount - COALESCE(b.commission_amount, 0)) > 0.005), 0) AS amount_drift_entries,
  COALESCE((SELECT COUNT(*) FROM lodge_commission_ledger l
            WHERE l.lodge_id = lo.id AND l.status <> 'VOIDED'
              AND COALESCE((SELECT SUM(a.amount) FROM lodge_commission_settlement_allocations a WHERE a.ledger_id = l.id), 0)
                  > l.commission_amount + 0.005), 0) AS over_applied_entries,
  GREATEST(COALESCE((SELECT SUM(s.amount) FROM lodge_commission_settlements s WHERE s.lodge_id = lo.id), 0)
         - COALESCE((SELECT SUM(a.amount) FROM lodge_commission_settlement_allocations a
                     JOIN lodge_commission_ledger l ON l.id = a.ledger_id WHERE l.lodge_id = lo.id), 0), 0) AS unapplied_payments,
  COALESCE((SELECT COUNT(*) FROM lodge_commission_ledger l
            WHERE l.lodge_id = lo.id AND l.status <> 'VOIDED'
              AND l.commission_amount > l.base_amount), 0) AS excessive_entries
FROM lodges lo
WHERE lo.deleted_at IS NULL;
