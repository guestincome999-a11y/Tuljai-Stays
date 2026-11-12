-- Reuse is_active for authoritative lodge closure; preserve verification and all reservations.
ALTER TABLE "lodges" ADD COLUMN "operations_reason" TEXT;
CREATE INDEX "booking_locks_active_availability_idx" ON "booking_locks" ("lodge_id", "status", "expires_at", "check_in_date", "check_out_date");
CREATE INDEX "payment_intents_status_updated_at_idx" ON "payment_intents" ("status", "updated_at");
