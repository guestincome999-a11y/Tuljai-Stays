-- Platform-to-lodge payments are distinct from lodge-to-platform commission receipts.
CREATE TABLE lodge_revenue_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id UUID NOT NULL REFERENCES lodges(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  commission_deducted NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (commission_deducted >= 0),
  commission_settlement_id UUID UNIQUE REFERENCES lodge_commission_settlements(id) ON DELETE RESTRICT,
  idempotency_key UUID NOT NULL UNIQUE,
  payment_method TEXT NOT NULL CHECK (length(trim(payment_method)) > 0),
  reference TEXT,
  notes TEXT,
  settled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lodge_revenue_settlements_lodge_date_idx
  ON lodge_revenue_settlements(lodge_id, settled_at DESC);
-- Read/write only through authorized Nest endpoints; no client Data API policies.
ALTER TABLE lodge_revenue_settlements ENABLE ROW LEVEL SECURITY;
