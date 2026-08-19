-- Keep the admin-facing system setting and the payment runtime setting in sync.
-- The admin panel writes system_settings.enable_online_payments, while the payment
-- service reads payment_settings. Without this bridge, the UI toggle has no effect.

CREATE OR REPLACE FUNCTION sync_online_payment_setting()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  enabled_value BOOLEAN;
BEGIN
  IF NEW.key <> 'enable_online_payments' THEN
    RETURN NEW;
  END IF;

  enabled_value := COALESCE((NEW.value #>> '{}')::BOOLEAN, false);

  UPDATE "payment_settings"
  SET
    "online_payments_enabled" = enabled_value,
    "provider" = CASE WHEN enabled_value THEN 'RAZORPAY' ELSE 'RAZORPAY' END,
    "display_status" = CASE WHEN enabled_value THEN 'ACTIVE' ELSE 'COMING_SOON' END,
    "updated_at" = CURRENT_TIMESTAMP;

  IF NOT FOUND THEN
    INSERT INTO "payment_settings" (
      "online_payments_enabled",
      "provider",
      "display_status"
    )
    VALUES (enabled_value, 'RAZORPAY', CASE WHEN enabled_value THEN 'ACTIVE' ELSE 'COMING_SOON' END);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS system_settings_online_payment_sync ON "system_settings";

CREATE TRIGGER system_settings_online_payment_sync
AFTER INSERT OR UPDATE OF "key", "value" ON "system_settings"
FOR EACH ROW
EXECUTE FUNCTION sync_online_payment_setting();

-- Repair an installation where the admin setting and payment runtime setting
-- were already out of sync before this migration was applied.
INSERT INTO "system_settings" ("key", "value", "description", "is_public")
SELECT 'enable_online_payments', 'false'::jsonb, 'Online payments enabled', true
WHERE NOT EXISTS (
  SELECT 1 FROM "system_settings" WHERE "key" = 'enable_online_payments'
);

UPDATE "payment_settings" ps
SET
  "online_payments_enabled" = COALESCE((ss."value" #>> '{}')::BOOLEAN, false),
  "provider" = 'RAZORPAY',
  "display_status" = CASE
    WHEN COALESCE((ss."value" #>> '{}')::BOOLEAN, false) THEN 'ACTIVE'
    ELSE 'COMING_SOON'
  END,
  "updated_at" = CURRENT_TIMESTAMP
FROM "system_settings" ss
WHERE ss."key" = 'enable_online_payments';
