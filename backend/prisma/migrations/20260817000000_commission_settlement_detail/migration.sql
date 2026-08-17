-- Link settlement payments to individual commission ledger entries so partial
-- payments remain auditable and a transaction is only marked SETTLED when its
-- full commission has been allocated.
CREATE TABLE "lodge_commission_settlement_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "settlement_id" UUID NOT NULL,
  "ledger_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lodge_commission_settlement_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lodge_commission_settlement_allocations_settlement_fkey"
    FOREIGN KEY ("settlement_id") REFERENCES "lodge_commission_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lodge_commission_settlement_allocations_ledger_fkey"
    FOREIGN KEY ("ledger_id") REFERENCES "lodge_commission_ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lodge_commission_settlement_allocations_amount_check"
    CHECK ("amount" > 0)
);

CREATE INDEX "lodge_commission_settlement_allocations_settlement_idx"
  ON "lodge_commission_settlement_allocations"("settlement_id");
CREATE INDEX "lodge_commission_settlement_allocations_ledger_idx"
  ON "lodge_commission_settlement_allocations"("ledger_id");

-- Commission type was introduced after the original percentage trigger. Rebuild
-- the snapshot trigger so FIXED_PER_BOOKING actually records the configured
-- fixed amount, while percentage mode continues to use total booking value.
CREATE OR REPLACE FUNCTION "tuljai_snapshot_lodge_commission"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  rule RECORD;
  calculated NUMERIC(12,2);
BEGIN
  SELECT "commission_enabled", "commission_type", "commission_rate_percent", "commission_fixed_amount"
    INTO rule
    FROM "lodge_commission_settings"
   WHERE "lodge_id" = NEW."lodge_id";

  IF FOUND AND rule.commission_enabled AND NEW."total_amount" IS NOT NULL THEN
    NEW."commission_rate_percent" := CASE
      WHEN rule.commission_type = 'PERCENTAGE' THEN rule.commission_rate_percent
      ELSE 0
    END;

    IF rule.commission_type = 'FIXED_PER_BOOKING' THEN
      calculated := ROUND(rule.commission_fixed_amount::numeric, 2);
    ELSE
      calculated := ROUND((NEW."total_amount" * rule.commission_rate_percent / 100.0)::numeric, 2);
    END IF;

    NEW."commission_amount" := calculated;
  ELSE
    NEW."commission_rate_percent" := NULL;
    NEW."commission_amount" := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Recalculate the monetary snapshot for existing bookings from their current
-- lodge rule. Historical ledger rows are intentionally left unchanged.
UPDATE "bookings" b
SET "commission_rate_percent" = CASE
      WHEN s."commission_type" = 'PERCENTAGE' THEN s."commission_rate_percent"
      ELSE 0
    END,
    "commission_amount" = CASE
      WHEN s."commission_type" = 'FIXED_PER_BOOKING' THEN ROUND(s."commission_fixed_amount"::numeric, 2)
      ELSE ROUND((b."total_amount" * s."commission_rate_percent" / 100.0)::numeric, 2)
    END
FROM "lodge_commission_settings" s
WHERE s."lodge_id" = b."lodge_id"
  AND s."commission_enabled" = true
  AND b."total_amount" IS NOT NULL;
