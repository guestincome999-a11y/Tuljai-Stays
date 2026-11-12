-- Additive only. Existing collections, commissions and historical cancellations are preserved.
CREATE TYPE "RefundStatus" AS ENUM ('NOT_REQUIRED','PENDING','INITIATED','PROCESSED','FAILED');
ALTER TABLE bookings ADD COLUMN cancelled_at TIMESTAMP(3), ADD COLUMN cancelled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN cancellation_policy JSONB;
ALTER TABLE notifications ADD COLUMN dedupe_key TEXT;
CREATE UNIQUE INDEX notifications_dedupe_key_key ON notifications(dedupe_key);
ALTER TABLE support_tickets ADD COLUMN booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
CREATE INDEX support_tickets_booking_id_idx ON support_tickets(booking_id);

CREATE TABLE booking_refunds (
  id UUID PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  collection_id UUID NOT NULL UNIQUE REFERENCES payment_collections(id) ON DELETE RESTRICT,
  provider_payment_id TEXT,
  captured_amount INTEGER CHECK (captured_amount >= 0),
  eligible_amount INTEGER CHECK (eligible_amount >= 0),
  amount INTEGER CHECK (amount >= 0),
  percent INTEGER CHECK (percent BETWEEN 0 AND 100),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  payment_method TEXT,
  status "RefundStatus" NOT NULL DEFAULT 'PENDING',
  reason TEXT NOT NULL,
  failure_reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_check_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_token TEXT,
  lease_until TIMESTAMP(3),
  initiated_at TIMESTAMP(3),
  processed_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  CONSTRAINT refund_captured_amount_check CHECK (captured_amount IS NULL OR amount <= captured_amount)
);
CREATE INDEX booking_refunds_booking_id_idx ON booking_refunds(booking_id);
CREATE INDEX booking_refunds_provider_payment_id_idx ON booking_refunds(provider_payment_id);
CREATE INDEX booking_refunds_status_next_check_at_idx ON booking_refunds(status,next_check_at);

CREATE TABLE refund_attempts (
  id UUID PRIMARY KEY,
  refund_id UUID NOT NULL REFERENCES booking_refunds(id) ON DELETE RESTRICT,
  receipt TEXT NOT NULL UNIQUE,
  provider_refund_id TEXT UNIQUE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  speed TEXT NOT NULL DEFAULT 'normal',
  status "RefundStatus" NOT NULL DEFAULT 'PENDING',
  requested_at TIMESTAMP(3),
  failure_reason TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX refund_attempts_refund_id_idx ON refund_attempts(refund_id);

CREATE TABLE refund_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  provider_refund_id TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  receipt TEXT,
  processed_at TIMESTAMP(3),
  last_error TEXT,
  next_check_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX refund_webhook_events_processed_at_next_check_at_idx ON refund_webhook_events(processed_at,next_check_at);
CREATE INDEX refund_webhook_events_provider_refund_id_idx ON refund_webhook_events(provider_refund_id);

CREATE TABLE refund_notification_outbox (
  key TEXT PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  refund_id UUID REFERENCES booking_refunds(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  delivered_at TIMESTAMP(3),
  lease_until TIMESTAMP(3),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_check_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX refund_notification_outbox_delivered_at_next_check_at_idx ON refund_notification_outbox(delivered_at,next_check_at);

INSERT INTO system_settings (id,key,value,description,is_public,created_at,updated_at)
VALUES (gen_random_uuid(),'booking_cancellation_policy',
  '{"configured":true,"tiers":[{"daysBeforeCheckIn":4,"refundPercent":100},{"daysBeforeCheckIn":2,"refundPercent":90},{"daysBeforeCheckIn":0,"refundPercent":80}]}'::jsonb,
  'Refund percentages by India calendar days before check-in',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Snapshot policy for NEW bookings only. No historical financial amounts are rewritten.
CREATE FUNCTION tuljai_snapshot_cancellation_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cancellation_policy IS NULL THEN
    SELECT value INTO NEW.cancellation_policy FROM system_settings WHERE key='booking_cancellation_policy';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER booking_cancellation_policy_snapshot BEFORE INSERT ON bookings
FOR EACH ROW EXECUTE FUNCTION tuljai_snapshot_cancellation_policy();

-- All pre-stay cancellations are terminal, including legacy update routes racing a cancellation.
CREATE FUNCTION tuljai_protect_cancelled_booking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='CANCELLED' AND NEW.status<>'CANCELLED' THEN
    RAISE EXCEPTION 'Cancelled bookings cannot be reactivated';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER booking_cancellation_terminal BEFORE UPDATE OF status ON bookings
FOR EACH ROW EXECUTE FUNCTION tuljai_protect_cancelled_booking();

-- Refund tables contain payment/user data; clients use authenticated Nest endpoints only.
ALTER TABLE booking_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_notification_outbox ENABLE ROW LEVEL SECURITY;
