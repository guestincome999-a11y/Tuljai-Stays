CREATE TABLE "booking_delivery_jobs" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "operation" TEXT NOT NULL DEFAULT 'initial',
  "recipient" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_token" UUID,
  "lease_until" TIMESTAMP(3),
  "last_attempt_at" TIMESTAMP(3),
  "last_error" TEXT,
  "submission_started_at" TIMESTAMP(3),
  "provider_message_id" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "booking_delivery_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_delivery_jobs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "booking_delivery_jobs_booking_id_type_operation_key" ON "booking_delivery_jobs"("booking_id", "type", "operation");
CREATE INDEX "booking_delivery_jobs_status_next_attempt_at_idx" ON "booking_delivery_jobs"("status", "next_attempt_at");
CREATE INDEX "booking_delivery_jobs_type_status_next_attempt_at_idx" ON "booking_delivery_jobs"("type", "status", "next_attempt_at");
CREATE INDEX "booking_delivery_jobs_status_lease_until_idx" ON "booking_delivery_jobs"("status", "lease_until");
ALTER TABLE "booking_delivery_jobs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "booking_delivery_jobs" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "booking_delivery_jobs" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "booking_delivery_jobs" FROM authenticated;
  END IF;
END $$;

-- No historical email backfill: only new confirmation transitions enqueue mail.
