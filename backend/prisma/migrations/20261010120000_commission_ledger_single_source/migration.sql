-- Single definition of "commission is owed to the platform".
-- Online (FULLY_PAID): as soon as payment is verified, unless the booking is dead.
-- Pay-at-lodge (cash): only once the guest has checked in.
CREATE OR REPLACE FUNCTION public.tuljai_commission_is_eligible(p_status text, p_payment_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_payment_status = 'FULLY_PAID' AND p_status NOT IN ('CANCELLED', 'REJECTED', 'EXPIRED'))
      OR (p_payment_status = 'PAY_AT_LODGE' AND p_status IN ('CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'));
$$;

-- Ledger entry is created when commission becomes eligible (previously: only on COMPLETED, which never happens).
CREATE OR REPLACE FUNCTION public.tuljai_create_commission_ledger_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."deleted_at" IS NULL
     AND NEW."commission_amount" IS NOT NULL
     AND NEW."commission_amount" > 0
     AND public.tuljai_commission_is_eligible(NEW."status"::text, NEW."payment_status"::text) THEN

    INSERT INTO "lodge_commission_ledger" (
      "lodge_id", "booking_id", "base_amount", "commission_rate_percent",
      "commission_amount", "commission_type", "commission_fixed_amount",
      "status", "eligible_at"
    ) VALUES (
      NEW."lodge_id", NEW."id", COALESCE(NEW."total_amount", 0),
      COALESCE(NEW."commission_rate_percent", 0), NEW."commission_amount",
      COALESCE(NEW."commission_type", 'PERCENTAGE'), COALESCE(NEW."commission_fixed_amount", 0),
      'OUTSTANDING', CURRENT_TIMESTAMP
    )
    ON CONFLICT ("booking_id") DO NOTHING;

  ELSIF TG_OP = 'UPDATE'
        AND (NEW."deleted_at" IS NOT NULL OR NEW."status"::text IN ('CANCELLED', 'REJECTED', 'EXPIRED')) THEN
    -- A dead booking owes no commission. Only untouched entries are voided;
    -- entries with settlement allocations are left for manual review (shown in reconciliation).
    UPDATE "lodge_commission_ledger" l
    SET "status" = 'VOIDED',
        "voided_at" = CURRENT_TIMESTAMP,
        "updated_at" = CURRENT_TIMESTAMP,
        "notes" = COALESCE(l."notes" || ' | ', '') || 'Auto-voided: booking cancelled, rejected, expired or removed.'
    WHERE l."booking_id" = NEW."id"
      AND l."status" = 'OUTSTANDING'
      AND NOT EXISTS (
        SELECT 1 FROM "lodge_commission_settlement_allocations" a WHERE a."ledger_id" = l."id"
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "booking_commission_ledger_on_completed" ON "bookings";
DROP TRIGGER IF EXISTS "booking_commission_ledger_sync" ON "bookings";
CREATE TRIGGER "booking_commission_ledger_sync"
  AFTER INSERT OR UPDATE OF "status", "payment_status", "commission_amount", "deleted_at" ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION public.tuljai_create_commission_ledger_entry();

-- Backfill: eligible bookings that never got a ledger entry.
INSERT INTO "lodge_commission_ledger" (
  "lodge_id", "booking_id", "base_amount", "commission_rate_percent",
  "commission_amount", "commission_type", "commission_fixed_amount",
  "status", "eligible_at", "notes"
)
SELECT
  b."lodge_id", b."id", COALESCE(b."total_amount", 0), COALESCE(b."commission_rate_percent", 0),
  b."commission_amount", COALESCE(b."commission_type", 'PERCENTAGE'), COALESCE(b."commission_fixed_amount", 0),
  'OUTSTANDING',
  (COALESCE(b."checked_in_at", b."updated_at") AT TIME ZONE 'UTC'),
  'Backfilled: commission was eligible but the ledger entry had never been created.'
FROM "bookings" b
WHERE b."deleted_at" IS NULL
  AND b."commission_amount" IS NOT NULL
  AND b."commission_amount" > 0
  AND public.tuljai_commission_is_eligible(b."status"::text, b."payment_status"::text)
  AND NOT EXISTS (SELECT 1 FROM "lodge_commission_ledger" l WHERE l."booking_id" = b."id")
ON CONFLICT ("booking_id") DO NOTHING;

-- The snapshot flag was always false even when commission was applied; record the truth.
CREATE OR REPLACE FUNCTION public.tuljai_snapshot_lodge_commission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rule RECORD;
  calculated NUMERIC(12,2);
BEGIN
  SELECT "commission_enabled", "commission_type", "commission_rate_percent", "commission_fixed_amount"
  INTO rule
  FROM "lodge_commission_settings"
  WHERE "lodge_id" = NEW."lodge_id" AND "effective_from" <= CURRENT_TIMESTAMP
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

UPDATE "bookings" SET "commission_enabled_snapshot" = true
WHERE "commission_amount" IS NOT NULL AND "commission_amount" > 0 AND "commission_enabled_snapshot" IS DISTINCT FROM true;

-- Integrity guard: a settlement can never be applied to more than the commission owed,
-- to a voided entry, to another lodge's entry, or for more than the settlement amount.
CREATE OR REPLACE FUNCTION public.tuljai_guard_commission_allocation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  led RECORD;
  st RECORD;
  ledger_allocated NUMERIC;
  settlement_allocated NUMERIC;
BEGIN
  SELECT "id", "lodge_id", "status", "commission_amount" INTO led
  FROM "lodge_commission_ledger" WHERE "id" = NEW."ledger_id" FOR UPDATE;
  SELECT "id", "lodge_id", "amount" INTO st
  FROM "lodge_commission_settlements" WHERE "id" = NEW."settlement_id";

  IF led."status" = 'VOIDED' THEN
    RAISE EXCEPTION 'Cannot apply a settlement to a voided commission entry.';
  END IF;
  IF led."lodge_id" <> st."lodge_id" THEN
    RAISE EXCEPTION 'Settlement and commission entry belong to different lodges.';
  END IF;

  SELECT COALESCE(SUM("amount"), 0) INTO ledger_allocated
  FROM "lodge_commission_settlement_allocations" WHERE "ledger_id" = NEW."ledger_id" AND "id" <> NEW."id";
  IF ledger_allocated + NEW."amount" > led."commission_amount" + 0.005 THEN
    RAISE EXCEPTION 'Settlement allocation exceeds the commission owed on this entry.';
  END IF;

  SELECT COALESCE(SUM("amount"), 0) INTO settlement_allocated
  FROM "lodge_commission_settlement_allocations" WHERE "settlement_id" = NEW."settlement_id" AND "id" <> NEW."id";
  IF settlement_allocated + NEW."amount" > st."amount" + 0.005 THEN
    RAISE EXCEPTION 'Allocations exceed the settlement amount.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "commission_allocation_guard" ON "lodge_commission_settlement_allocations";
CREATE TRIGGER "commission_allocation_guard"
  BEFORE INSERT OR UPDATE ON "lodge_commission_settlement_allocations"
  FOR EACH ROW EXECUTE FUNCTION public.tuljai_guard_commission_allocation();

-- A ledger entry with money already applied can't be voided or reduced below what was applied.
CREATE OR REPLACE FUNCTION public.tuljai_guard_commission_ledger_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allocated NUMERIC;
BEGIN
  SELECT COALESCE(SUM("amount"), 0) INTO allocated
  FROM "lodge_commission_settlement_allocations" WHERE "ledger_id" = NEW."id";
  IF allocated > 0 AND NEW."status" = 'VOIDED' AND OLD."status" <> 'VOIDED' THEN
    RAISE EXCEPTION 'Cannot void a commission entry that already has settlement payments applied.';
  END IF;
  IF allocated > NEW."commission_amount" + 0.005 THEN
    RAISE EXCEPTION 'Commission amount cannot be less than the settlement payments already applied.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "commission_ledger_guard" ON "lodge_commission_ledger";
CREATE TRIGGER "commission_ledger_guard"
  BEFORE UPDATE ON "lodge_commission_ledger"
  FOR EACH ROW EXECUTE FUNCTION public.tuljai_guard_commission_ledger_update();

-- One place that defines the balances every screen must agree with.
CREATE OR REPLACE VIEW public.lodge_commission_balances AS
WITH led AS (
  SELECT lodge_id,
         SUM(commission_amount) FILTER (WHERE status <> 'VOIDED') AS receivable,
         SUM(commission_amount) FILTER (WHERE status = 'VOIDED') AS voided
  FROM lodge_commission_ledger GROUP BY lodge_id
), alloc AS (
  SELECT l.lodge_id, SUM(a.amount) AS allocated
  FROM lodge_commission_settlement_allocations a
  JOIN lodge_commission_ledger l ON l.id = a.ledger_id AND l.status <> 'VOIDED'
  GROUP BY l.lodge_id
), st AS (
  SELECT lodge_id, SUM(amount) AS settlements_total FROM lodge_commission_settlements GROUP BY lodge_id
)
SELECT lo.id AS lodge_id,
       lo.name AS lodge_name,
       COALESCE(led.receivable, 0) AS receivable,
       COALESCE(alloc.allocated, 0) AS settled,
       COALESCE(led.receivable, 0) - COALESCE(alloc.allocated, 0) AS outstanding,
       COALESCE(led.voided, 0) AS voided,
       COALESCE(st.settlements_total, 0) AS settlements_total,
       COALESCE(st.settlements_total, 0) - COALESCE(alloc.allocated, 0) AS unapplied_payments
FROM lodges lo
LEFT JOIN led ON led.lodge_id = lo.id
LEFT JOIN alloc ON alloc.lodge_id = lo.id
LEFT JOIN st ON st.lodge_id = lo.id
WHERE lo.deleted_at IS NULL;

-- Automatic accounting check. Every column except lodge identity should be 0 for a healthy lodge.
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
                     JOIN lodge_commission_ledger l ON l.id = a.ledger_id WHERE l.lodge_id = lo.id), 0), 0) AS unapplied_payments
FROM lodges lo
WHERE lo.deleted_at IS NULL;
