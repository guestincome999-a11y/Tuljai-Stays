BEGIN;

ALTER TABLE "booking_locks" ADD COLUMN "checkout_attempt_key" TEXT;
CREATE UNIQUE INDEX "booking_locks_pilgrim_user_id_checkout_attempt_key_key"
  ON "booking_locks" ("pilgrim_user_id", "checkout_attempt_key");

CREATE TABLE "payment_order_requests" (
  "reference" TEXT PRIMARY KEY,
  "receipt" TEXT NOT NULL UNIQUE,
  "amount" INTEGER NOT NULL CHECK ("amount" > 0),
  "currency" TEXT NOT NULL CHECK ("currency" = 'INR'),
  "status" TEXT NOT NULL DEFAULT 'NEW'
    CHECK ("status" IN ('NEW', 'CREATING', 'CREATED', 'UNKNOWN')),
  "provider_order_id" TEXT UNIQUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_order_requests_created_check"
    CHECK ("status" <> 'CREATED' OR "provider_order_id" IS NOT NULL)
);

ALTER TABLE "payment_order_requests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "payment_order_requests" FROM PUBLIC;
DO $$
DECLARE api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON payment_order_requests FROM %I', api_role);
    END IF;
  END LOOP;
END $$;

COMMIT;
