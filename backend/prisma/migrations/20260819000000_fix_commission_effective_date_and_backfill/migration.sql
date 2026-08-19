-- Make lodge commission effective dates authoritative and recover completed bookings
-- that already have an immutable commission snapshot but no ledger row.

DROP TRIGGER IF EXISTS "booking_lodge_commission_snapshot" ON "bookings";

CREATE OR REPLACE FUNCTION "tuljai_snapshot_lodge_commission"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  rule RECORD;
  calculated NUMERIC(12,2);
BEGIN
  SELECT
    "commission_enabled",
    "commission_type",
    "commission_rate_percent",
    "commission_fixed_amount"
  INTO rule
  FROM "lodge_commission_settings"
  WHERE "lodge_id" = NEW."lodge_id"
    AND "effective_from" <= CURRENT_TIMESTAMP
  ORDER BY "effective_from" DESC
  LIMIT 1;

  IF FOUND AND rule.commission_enabled AND NEW."total_amount" IS NOT NULL THEN
    NEW."commission_type" := COALESCE(rule.commission_type, 'PERCENTAGE');

    IF NEW."commission_type" = 'FIXED_PER_BOOKING' THEN
      NEW."commission_rate_percent" := NULL;
      NEW."commission_fixed_amount" := COALESCE(rule.commission_fixed_amount, 0);
      calculated := ROUND(NEW."commission_fixed_amount"::numeric, 2);
    ELSE
      NEW."commission_type" := 'PERCENTAGE';
      NEW."commission_rate_percent" := COALESCE(rule.commission_rate_percent, 0);
      NEW."commission_fixed_amount" := 0;
      calculated := ROUND((NEW."total_amount" * NEW."commission_rate_percent" / 100.0)::numeric, 2);
    END IF;

    NEW."commission_amount" := calculated;
  ELSE
    NEW."commission_type" := 'PERCENTAGE';
    NEW."commission_rate_percent" := NULL;
    NEW."commission_fixed_amount" := 0;
    NEW."commission_amount" := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "booking_lodge_commission_snapshot"
BEFORE INSERT OR UPDATE OF "lodge_id", "total_amount"
ON "bookings"
FOR EACH ROW
EXECUTE FUNCTION "tuljai_snapshot_lodge_commission"();

-- Recover payable commission for completed bookings whose snapshot exists but
-- whose ledger entry was missed during an earlier deployment.
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
  COALESCE(b."checked_out_at", b."updated_at", CURRENT_TIMESTAMP)
FROM "bookings" b
LEFT JOIN "lodge_commission_ledger" l ON l."booking_id" = b."id"
WHERE b."status" = 'COMPLETED'
  AND b."commission_amount" IS NOT NULL
  AND b."commission_amount" > 0
  AND l."id" IS NULL;
