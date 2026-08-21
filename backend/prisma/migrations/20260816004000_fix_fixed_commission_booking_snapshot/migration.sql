-- Complete fixed-per-booking commission support in the database snapshot/ledger path.
-- Existing booking commission amounts are preserved. New bookings use the lodge's
-- active commission type and snapshot the rule used for that booking.

ALTER TABLE "bookings"
  ADD COLUMN "commission_type" TEXT NOT NULL DEFAULT 'PERCENTAGE',
  ADD COLUMN "commission_fixed_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_commission_type_check"
  CHECK ("commission_type" IN ('PERCENTAGE', 'FIXED_PER_BOOKING'));

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_commission_fixed_amount_check"
  CHECK ("commission_fixed_amount" >= 0);

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
  WHERE "lodge_id" = NEW."lodge_id";

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

DROP TRIGGER IF EXISTS "booking_commission_ledger_on_completed" ON "bookings";

CREATE OR REPLACE FUNCTION "tuljai_create_commission_ledger_entry"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" = 'COMPLETED'
     AND (TG_OP = 'INSERT' OR OLD."status" IS DISTINCT FROM 'COMPLETED')
     AND NEW."commission_amount" IS NOT NULL
     AND NEW."commission_amount" > 0 THEN

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
    ) VALUES (
      NEW."lodge_id",
      NEW."id",
      COALESCE(NEW."total_amount", 0),
      COALESCE(NEW."commission_rate_percent", 0),
      NEW."commission_amount",
      COALESCE(NEW."commission_type", 'PERCENTAGE'),
      COALESCE(NEW."commission_fixed_amount", 0),
      'OUTSTANDING',
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("booking_id") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "booking_commission_ledger_on_completed"
AFTER INSERT OR UPDATE OF "status"
ON "bookings"
FOR EACH ROW
EXECUTE FUNCTION "tuljai_create_commission_ledger_entry"();
