-- Repair commission accounting for bookings created before/without the active commission snapshot.
-- Historical commission is derived only when the booking has no commission snapshot.

UPDATE "bookings" b
SET
  "commission_type" = CASE
    WHEN s."commission_type" = 'FIXED_PER_BOOKING' THEN 'FIXED_PER_BOOKING'
    ELSE 'PERCENTAGE'
  END,
  "commission_rate_percent" = CASE
    WHEN s."commission_type" = 'FIXED_PER_BOOKING' THEN NULL
    ELSE COALESCE(s."commission_rate_percent", 0)
  END,
  "commission_fixed_amount" = CASE
    WHEN s."commission_type" = 'FIXED_PER_BOOKING' THEN COALESCE(s."commission_fixed_amount", 0)
    ELSE 0
  END,
  "commission_amount" = CASE
    WHEN s."commission_type" = 'FIXED_PER_BOOKING' THEN ROUND(COALESCE(s."commission_fixed_amount", 0)::numeric, 2)
    ELSE ROUND((COALESCE(b."total_amount", 0) * COALESCE(s."commission_rate_percent", 0) / 100.0)::numeric, 2)
  END
FROM "lodge_commission_settings" s
WHERE s."lodge_id" = b."lodge_id"
  AND s."commission_enabled" = true
  AND b."commission_amount" IS NULL
  AND b."total_amount" IS NOT NULL;

-- Rebuild the payable ledger for completed bookings that were completed before the
-- ledger trigger existed or while their commission snapshot was missing.
INSERT INTO "lodge_commission_ledger" (
  "lodge_id",
  "booking_id",
  "base_amount",
  "commission_rate_percent",
  "commission_amount",
  "commission_type",
  "commission_fixed_amount",
  "status",
  "eligible_at"
)
SELECT
  b."lodge_id",
  b."id",
  COALESCE(b."total_amount", 0),
  COALESCE(b."commission_rate_percent", 0),
  b."commission_amount",
  COALESCE(b."commission_type", 'PERCENTAGE'),
  COALESCE(b."commission_fixed_amount", 0),
  'OUTSTANDING',
  COALESCE(b."updated_at", CURRENT_TIMESTAMP)
FROM "bookings" b
WHERE b."status" = 'COMPLETED'
  AND b."commission_amount" IS NOT NULL
  AND b."commission_amount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "lodge_commission_ledger" l WHERE l."booking_id" = b."id"
  );
