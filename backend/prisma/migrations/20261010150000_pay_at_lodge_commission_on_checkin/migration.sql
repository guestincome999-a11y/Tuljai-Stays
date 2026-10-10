-- Pay-at-lodge rule: no commission is recorded while the booking is waiting for the pilgrim to arrive.
-- Commission is calculated (with the lodge's rule at that moment) only when the pilgrim checks in.
-- Prepaid bookings keep the existing behaviour: calculated when the booking is created.
CREATE OR REPLACE FUNCTION public.tuljai_snapshot_lodge_commission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rule RECORD;
  calculated NUMERIC(12,2);
  arrived_states CONSTANT text[] := ARRAY['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'];
  waiting_pay_at_lodge BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."lodge_id" IS DISTINCT FROM OLD."lodge_id"
       OR NEW."total_amount" IS DISTINCT FROM OLD."total_amount" THEN
      NULL; -- re-price as before
    ELSIF NEW."payment_status"::text = 'PAY_AT_LODGE'
          AND ((NEW."status"::text = ANY (arrived_states) AND NOT (OLD."status"::text = ANY (arrived_states)))
               OR OLD."payment_status"::text IS DISTINCT FROM 'PAY_AT_LODGE') THEN
      NULL; -- pilgrim just checked in (or booking just became pay-at-lodge)
    ELSE
      RETURN NEW; -- other status changes never re-price a booking
    END IF;
  END IF;

  waiting_pay_at_lodge := NEW."payment_status"::text = 'PAY_AT_LODGE'
                          AND NOT (NEW."status"::text = ANY (arrived_states));

  SELECT "commission_enabled", "commission_type", "commission_rate_percent", "commission_fixed_amount"
  INTO rule
  FROM "lodge_commission_settings"
  WHERE "lodge_id" = NEW."lodge_id" AND "effective_from" <= CURRENT_TIMESTAMP
  ORDER BY "effective_from" DESC
  LIMIT 1;

  IF NOT waiting_pay_at_lodge AND FOUND AND rule.commission_enabled AND NEW."total_amount" IS NOT NULL THEN
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
    NEW."commission_enabled_snapshot" := true;
  ELSE
    NEW."commission_type" := 'PERCENTAGE';
    NEW."commission_rate_percent" := NULL;
    NEW."commission_fixed_amount" := 0;
    NEW."commission_amount" := NULL;
    NEW."commission_enabled_snapshot" := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "booking_lodge_commission_snapshot" ON "bookings";
CREATE TRIGGER "booking_lodge_commission_snapshot"
  BEFORE INSERT OR UPDATE OF "lodge_id", "total_amount", "status", "payment_status" ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION public.tuljai_snapshot_lodge_commission();

-- Clean up: pay-at-lodge bookings that were never checked in must not carry a recorded commission.
UPDATE "bookings" b
SET "commission_amount" = NULL,
    "commission_rate_percent" = NULL,
    "commission_fixed_amount" = 0,
    "commission_type" = 'PERCENTAGE',
    "commission_enabled_snapshot" = false
WHERE b."payment_status"::text = 'PAY_AT_LODGE'
  AND b."status"::text NOT IN ('CHECKED_IN', 'CHECKED_OUT', 'COMPLETED')
  AND b."commission_amount" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "lodge_commission_ledger" l WHERE l."booking_id" = b."id");
