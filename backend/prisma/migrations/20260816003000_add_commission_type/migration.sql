-- Support either percentage commission or a fixed rupee amount per booking.
ALTER TABLE "lodge_commission_settings"
  ADD COLUMN "commission_type" TEXT NOT NULL DEFAULT 'PERCENTAGE',
  ADD COLUMN "commission_fixed_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "lodge_commission_settings"
  ADD CONSTRAINT "lodge_commission_settings_type_check"
  CHECK ("commission_type" IN ('PERCENTAGE', 'FIXED_PER_BOOKING'));

ALTER TABLE "lodge_commission_settings"
  ADD CONSTRAINT "lodge_commission_settings_fixed_amount_check"
  CHECK ("commission_fixed_amount" >= 0);

ALTER TABLE "lodge_commission_ledger"
  ADD COLUMN "commission_type" TEXT NOT NULL DEFAULT 'PERCENTAGE',
  ADD COLUMN "commission_fixed_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "lodge_commission_ledger"
  ADD CONSTRAINT "lodge_commission_ledger_type_check"
  CHECK ("commission_type" IN ('PERCENTAGE', 'FIXED_PER_BOOKING'));

ALTER TABLE "lodge_commission_ledger"
  ADD CONSTRAINT "lodge_commission_ledger_fixed_amount_check"
  CHECK ("commission_fixed_amount" >= 0);
