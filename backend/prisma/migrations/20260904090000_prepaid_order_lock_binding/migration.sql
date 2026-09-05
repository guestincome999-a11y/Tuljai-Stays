-- Supports creating the Razorpay order while the guest is still reviewing
-- checkout (bound to their room hold), so the checkout sheet can open
-- instantly on tap instead of waiting on a booking to exist first. The
-- booking itself is only created after payment is verified as captured;
-- if payment never succeeds, no booking is ever created and the lock simply
-- expires on its normal TTL like any other unused hold.

ALTER TABLE "booking_locks"
  ADD COLUMN "provider_order_id" TEXT,
  ADD COLUMN "order_amount" DECIMAL(12,2);

CREATE UNIQUE INDEX "booking_locks_provider_order_id_key"
  ON "booking_locks"("provider_order_id")
  WHERE "provider_order_id" IS NOT NULL;
