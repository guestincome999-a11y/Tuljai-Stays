-- Lodge commission accounting foundation.
-- Existing Booking.commissionAmount is retained as the monetary snapshot.
-- Booking.commissionRatePercent stores the immutable rate used for that booking.
-- The ledger records only commission that becomes payable after COMPLETED.

ALTER TABLE "bookings"
  ADD COLUMN "commission_rate_percent" DECIMAL(5,2);

CREATE TABLE "lodge_commission_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lodge_id" UUID NOT NULL,
  "commission_enabled" BOOLEAN NOT NULL DEFAULT true,
  "commission_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "effective_from" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lodge_commission_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lodge_commission_settings_lodge_id_key" UNIQUE ("lodge_id"),
  CONSTRAINT "lodge_commission_settings_lodge_id_fkey"
    FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lodge_commission_settings_rate_check"
    CHECK ("commission_rate_percent" >= 0 AND "commission_rate_percent" <= 100)
);

CREATE INDEX "lodge_commission_settings_enabled_idx"
  ON "lodge_commission_settings"("commission_enabled");

CREATE TABLE "lodge_commission_ledger" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lodge_id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "base_amount" DECIMAL(12,2) NOT NULL,
  "commission_rate_percent" DECIMAL(5,2) NOT NULL,
  "commission_amount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OUTSTANDING',
  "eligible_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at" TIMESTAMPTZ,
  "voided_at" TIMESTAMPTZ,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lodge_commission_ledger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lodge_commission_ledger_booking_id_key" UNIQUE ("booking_id"),
  CONSTRAINT "lodge_commission_ledger_lodge_id_fkey"
    FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lodge_commission_ledger_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lodge_commission_ledger_status_check"
    CHECK ("status" IN ('OUTSTANDING', 'SETTLED', 'VOIDED'))
);

CREATE INDEX "lodge_commission_ledger_lodge_status_idx"
  ON "lodge_commission_ledger"("lodge_id", "status");
CREATE INDEX "lodge_commission_ledger_eligible_at_idx"
  ON "lodge_commission_ledger"("eligible_at");
CREATE INDEX "lodge_commission_ledger_created_at_idx"
  ON "lodge_commission_ledger"("created_at");

CREATE TABLE "lodge_commission_settlements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lodge_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "payment_method" TEXT NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "settled_by_user_id" UUID,
  "settled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lodge_commission_settlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lodge_commission_settlements_lodge_id_fkey"
    FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lodge_commission_settlements_settled_by_user_id_fkey"
    FOREIGN KEY ("settled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "lodge_commission_settlements_amount_check"
    CHECK ("amount" > 0)
);

CREATE INDEX "lodge_commission_settlements_lodge_settled_at_idx"
  ON "lodge_commission_settlements"("lodge_id", "settled_at");

CREATE OR REPLACE FUNCTION "tuljai_snapshot_lodge_commission"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  rule RECORD;
  calculated NUMERIC(12,2);
BEGIN
  SELECT "commission_enabled", "commission_rate_percent"
    INTO rule
    FROM "lodge_commission_settings"
   WHERE "lodge_id" = NEW."lodge_id";

  IF FOUND AND rule.commission_enabled AND NEW."total_amount" IS NOT NULL THEN
    NEW."commission_rate_percent" := rule.commission_rate_percent;
    calculated := ROUND((NEW."total_amount" * rule.commission_rate_percent / 100.0)::numeric, 2);
    NEW."commission_amount" := calculated;
  ELSE
    NEW."commission_rate_percent" := NULL;
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

CREATE TRIGGER "booking_commission_ledger_on_completed"
AFTER INSERT OR UPDATE OF "status"
ON "bookings"
FOR EACH ROW
EXECUTE FUNCTION "tuljai_create_commission_ledger_entry"();

INSERT INTO "lodge_commission_settings" ("lodge_id", "commission_enabled", "commission_rate_percent")
SELECT "id", false, 0
FROM "lodges"
ON CONFLICT ("lodge_id") DO NOTHING;
