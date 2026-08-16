-- Payment collection and online-payment provider abstraction.
-- Online payments are intentionally OFF by default until an admin enables them.

CREATE TABLE "payment_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "online_payments_enabled" BOOLEAN NOT NULL DEFAULT false,
  "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
  "display_status" TEXT NOT NULL DEFAULT 'COMING_SOON',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_settings_provider_check"
    CHECK ("provider" IN ('RAZORPAY', 'NONE', 'OTHER')),
  CONSTRAINT "payment_settings_display_status_check"
    CHECK ("display_status" IN ('ACTIVE', 'COMING_SOON', 'DISABLED'))
);

CREATE TABLE "payment_collections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "booking_id" UUID NOT NULL,
  "method" TEXT NOT NULL,
  "provider" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "provider_order_id" TEXT,
  "provider_payment_id" TEXT,
  "provider_reference" TEXT,
  "paid_at" TIMESTAMPTZ,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_collections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_collections_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_collections_method_check"
    CHECK ("method" IN ('ONLINE', 'PAY_AT_LODGE')),
  CONSTRAINT "payment_collections_provider_check"
    CHECK ("provider" IS NULL OR "provider" IN ('RAZORPAY', 'OTHER')),
  CONSTRAINT "payment_collections_status_check"
    CHECK ("status" IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED')),
  CONSTRAINT "payment_collections_amount_check"
    CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "payment_collections_provider_payment_id_key"
  ON "payment_collections"("provider_payment_id")
  WHERE "provider_payment_id" IS NOT NULL;
CREATE INDEX "payment_collections_booking_idx"
  ON "payment_collections"("booking_id");
CREATE INDEX "payment_collections_method_status_idx"
  ON "payment_collections"("method", "status");
CREATE INDEX "payment_collections_paid_at_idx"
  ON "payment_collections"("paid_at");

-- Connect each commission ledger row to the actual collection used for settlement.
ALTER TABLE "lodge_commission_ledger"
  ADD COLUMN "collection_id" UUID,
  ADD COLUMN "online_commission_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "lodge_net_payable" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "lodge_commission_ledger"
  ADD CONSTRAINT "lodge_commission_ledger_collection_id_fkey"
  FOREIGN KEY ("collection_id") REFERENCES "payment_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lodge_commission_ledger"
  ADD CONSTRAINT "lodge_commission_ledger_online_deduction_check"
  CHECK ("online_commission_deduction" >= 0 AND "online_commission_deduction" <= "commission_amount");

ALTER TABLE "lodge_commission_ledger"
  ADD CONSTRAINT "lodge_commission_ledger_net_payable_check"
  CHECK ("lodge_net_payable" >= 0);

CREATE INDEX "lodge_commission_ledger_collection_idx"
  ON "lodge_commission_ledger"("collection_id");

-- Every current installation starts with online payments disabled.
INSERT INTO "payment_settings" ("online_payments_enabled", "provider", "display_status")
SELECT false, 'RAZORPAY', 'COMING_SOON'
WHERE NOT EXISTS (SELECT 1 FROM "payment_settings");
