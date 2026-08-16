-- Make the booking commission snapshot truly immutable.
-- The original foundation migration stored the amount but did not persist the rate.

ALTER TABLE "bookings"
  ADD COLUMN "commission_rate_percent" DECIMAL(5,2),
  ADD COLUMN "commission_enabled_snapshot" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "bookings_commission_rate_idx"
  ON "bookings"("commission_rate_percent");

DROP TRIGGER IF EXISTS "booking_lodge_commission_snapshot" ON "bookings";

CREATE OR REPLACE FUNCTION "tuljai_snapshot_lodge_commission"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  rule RECORD;
BEGIN
  -- Snapshot only on booking creation. Historical commission must not change when
  -- a lodge edits its current commercial rule later.
  SELECT "commission_enabled", "commission_rate_percent"
    INTO rule
    FROM "lodge_commission_settings"
   WHERE "lodge_id" = NEW."lodge_id";

  IF FOUND AND rule.commission_enabled THEN
    NEW."commission_enabled_snapshot" := true;
    NEW."commission_rate_percent" := rule.commission_rate_percent;
    NEW."commission_amount" := ROUND(
      (COALESCE(NEW."total_amount", 0) * rule.commission_rate_percent / 100.0)::numeric,
      2
    );
  ELSE
    NEW."commission_enabled_snapshot" := false;
    NEW."commission_rate_percent" := 0;
    NEW."commission_amount" := 0;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "booking_lodge_commission_snapshot"
BEFORE INSERT
ON "bookings"
FOR EACH ROW
EXECUTE FUNCTION "tuljai_snapshot_lodge_commission"();

-- Use the frozen booking rate when creating the ledger entry.
CREATE OR REPLACE FUNCTION "tuljai_create_commission_ledger_entry"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" = 'COMPLETED'
     AND (TG_OP = 'INSERT' OR OLD."status" IS DISTINCT FROM 'COMPLETED')
     AND NEW."commission_enabled_snapshot" = true
     AND NEW."commission_amount" IS NOT NULL
     AND NEW."commission_amount" > 0 THEN

    INSERT INTO "lodge_commission_ledger" (
      "lodge_id", "booking_id", "base_amount", "commission_rate_percent",
      "commission_amount", "status", "eligible_at"
    ) VALUES (
      NEW."lodge_id", NEW."id", COALESCE(NEW."total_amount", 0),
      COALESCE(NEW."commission_rate_percent", 0), NEW."commission_amount",
      'OUTSTANDING', CURRENT_TIMESTAMP
    )
    ON CONFLICT ("booking_id") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
