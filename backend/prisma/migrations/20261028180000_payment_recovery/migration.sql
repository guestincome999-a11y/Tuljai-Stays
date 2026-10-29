BEGIN;

-- Additive only. Existing bookings retain a NULL source_lock_id; no historical
-- payment data is rewritten. Resolve historical migration drift before deployment.
ALTER TABLE "bookings" ADD COLUMN "source_lock_id" UUID;
CREATE UNIQUE INDEX "bookings_source_lock_id_key" ON "bookings"("source_lock_id");

CREATE TABLE "payment_intents" (
  "id" UUID NOT NULL,
  "lock_code" TEXT NOT NULL,
  "pilgrim_user_id" UUID NOT NULL,
  "provider_order_id" TEXT NOT NULL,
  "provider_payment_id" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "guest_details" JSONB,
  "booking_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "last_error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_check_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_intents_status_check" CHECK ("status" IN ('PENDING', 'CONFIRMED', 'RECOVERY_REQUIRED')),
  CONSTRAINT "payment_intents_amount_check" CHECK ("amount" > 0 AND "currency" = 'INR')
);
CREATE UNIQUE INDEX "payment_intents_lock_code_key" ON "payment_intents"("lock_code");
CREATE UNIQUE INDEX "payment_intents_provider_order_id_key" ON "payment_intents"("provider_order_id");
CREATE UNIQUE INDEX "payment_intents_provider_payment_id_key" ON "payment_intents"("provider_payment_id");
CREATE UNIQUE INDEX "payment_intents_booking_id_key" ON "payment_intents"("booking_id");
CREATE INDEX "payment_intents_status_next_check_at_idx" ON "payment_intents"("status", "next_check_at");

CREATE TABLE "payment_webhook_events" (
  "id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "provider_order_id" TEXT NOT NULL,
  "provider_payment_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- Supabase API roles must never read guest details or payment references directly.
ALTER TABLE "payment_intents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_webhook_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "payment_intents", "payment_webhook_events" FROM PUBLIC;
DO $$
DECLARE api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON payment_intents, payment_webhook_events FROM %I', api_role);
    END IF;
  END LOOP;
END $$;

-- Refuse ambiguous historical data rather than picking a financial record silently.
DO $$ BEGIN
  IF EXISTS (
    SELECT provider_order_id FROM payment_collections WHERE provider_order_id IS NOT NULL
      AND status IN ('PENDING','FAILED','PAID') GROUP BY provider_order_id HAVING count(*) > 1
  ) OR EXISTS (
    SELECT booking_id FROM payment_collections WHERE provider_order_id IS NOT NULL
      AND status IN ('PENDING','FAILED','PAID') GROUP BY booking_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Ambiguous historical payment collections: reconcile duplicate order/booking groups before payment recovery migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM payment_collections c JOIN bookings b ON b.id=c.booking_id
      WHERE c.provider_order_id IS NOT NULL AND c.status IN ('PENDING','FAILED','PAID')
      AND (b.total_amount IS NULL OR b.total_amount <= 0)
  ) THEN
    RAISE EXCEPTION 'Invalid historical booking amount: reconcile before payment recovery migration';
  END IF;
END $$;

INSERT INTO payment_intents (id, lock_code, pilgrim_user_id, provider_order_id, provider_payment_id,
  amount, booking_id, status, created_at, updated_at)
SELECT gen_random_uuid(), 'legacy:' || b.id::text, b.pilgrim_user_id, c.provider_order_id,
  CASE WHEN c.status='PAID' THEN c.provider_payment_id ELSE NULL END,
  b.total_amount, b.id,
  CASE WHEN c.status='PAID' AND b.payment_status='FULLY_PAID' THEN 'CONFIRMED' ELSE 'PENDING' END,
  c.created_at, CURRENT_TIMESTAMP
FROM payment_collections c JOIN bookings b ON b.id=c.booking_id
WHERE c.provider_order_id IS NOT NULL AND c.status IN ('PENDING','FAILED','PAID')
  AND NOT EXISTS (SELECT 1 FROM payment_intents i WHERE i.provider_order_id=c.provider_order_id);

-- Older hold-first checkouts have no durable guest snapshot. Never invent one;
-- a captured payment without details is surfaced for operator recovery.
INSERT INTO payment_intents (id, lock_code, pilgrim_user_id, provider_order_id, amount, created_at, updated_at)
SELECT gen_random_uuid(), h.lock_code, h.pilgrim_user_id, h.provider_order_id, h.order_amount,
  h.created_at, CURRENT_TIMESTAMP
FROM booking_locks h
WHERE h.provider_order_id IS NOT NULL AND h.order_amount > 0
  AND NOT EXISTS (SELECT 1 FROM payment_intents i WHERE i.provider_order_id=h.provider_order_id);

COMMIT;
