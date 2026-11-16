-- Gateway transactions allocate into the existing commission ledger; no historical rates change.
ALTER TABLE lodge_revenue_settlements ADD COLUMN bank_name TEXT,
  ADD COLUMN account_last4 TEXT CHECK (account_last4 IS NULL OR account_last4 ~ '^[0-9]{4}$');
CREATE TABLE commission_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  lodge_id UUID NOT NULL REFERENCES lodges(id) ON DELETE RESTRICT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUCCESSFUL','FAILED','CANCELLED','REFUNDED','RECOVERY_REQUIRED')),
  order_id TEXT UNIQUE, payment_id TEXT UNIQUE, method TEXT,
  settlement_id UUID UNIQUE REFERENCES lodge_commission_settlements(id) ON DELETE RESTRICT,
  verified_at TIMESTAMPTZ, last_checked_at TIMESTAMPTZ, webhook_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Unknown order outcomes retain their reservation; retry recovers by the unique receipt.
CREATE UNIQUE INDEX commission_payments_active_lodge_idx ON commission_payments(lodge_id)
  WHERE status IN ('PENDING','FAILED','CANCELLED','RECOVERY_REQUIRED');
CREATE INDEX commission_payments_history_idx ON commission_payments(created_at DESC, id);
CREATE INDEX commission_payments_effective_date_idx ON commission_payments(COALESCE(verified_at,created_at) DESC,id);
CREATE INDEX commission_payments_owner_idx ON commission_payments(owner_id, created_at DESC);
CREATE TABLE commission_payment_items (
  payment_id UUID NOT NULL REFERENCES commission_payments(id) ON DELETE RESTRICT,
  ledger_id UUID NOT NULL REFERENCES lodge_commission_ledger(id) ON DELETE RESTRICT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  PRIMARY KEY(payment_id, ledger_id)
);
CREATE INDEX commission_payment_items_ledger_idx ON commission_payment_items(ledger_id);
CREATE INDEX bookings_lodge_created_finance_idx ON bookings(lodge_id, created_at DESC) WHERE deleted_at IS NULL;
ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payment_items ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION protect_commission_payment_items() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Commission payment booking allocations are immutable'; END; $$;
CREATE TRIGGER commission_payment_items_immutable BEFORE UPDATE OR DELETE ON commission_payment_items
  FOR EACH ROW EXECUTE FUNCTION protect_commission_payment_items();
CREATE FUNCTION protect_commission_payment_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.entity_type='commission_payment' OR OLD.action IN ('LODGE_COMMISSION_SETTLEMENT_CREATED','LODGE_COMMISSION_TRANSACTION_VOIDED','LODGE_REVENUE_SETTLEMENT_CREATED') THEN RAISE EXCEPTION 'Commission payment audit records are immutable'; END IF;
  IF TG_OP='UPDATE' THEN RETURN NEW; END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER commission_payment_audit_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION protect_commission_payment_audit();
