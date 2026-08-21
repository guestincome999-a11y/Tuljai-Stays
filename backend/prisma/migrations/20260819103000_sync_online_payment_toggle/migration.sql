-- Keep the admin Live Operations toggle and the Razorpay runtime in sync.
-- The admin control writes system_settings.enable_online_payments while the
-- payment service reads payment_settings. This trigger makes them one source
-- of truth without requiring a second admin control.

CREATE OR REPLACE FUNCTION sync_online_payment_setting()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.key = 'enable_online_payments' THEN
    UPDATE payment_settings
    SET online_payments_enabled = COALESCE((NEW.value #>> '{}')::boolean, false),
        provider = 'RAZORPAY',
        display_status = CASE
          WHEN COALESCE((NEW.value #>> '{}')::boolean, false) THEN 'ACTIVE'
          ELSE 'DISABLED'
        END,
        updated_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_online_payment_setting ON system_settings;

CREATE TRIGGER trg_sync_online_payment_setting
AFTER INSERT OR UPDATE OF value ON system_settings
FOR EACH ROW
EXECUTE FUNCTION sync_online_payment_setting();

-- Repair an existing installation immediately when this migration is deployed.
UPDATE payment_settings
SET online_payments_enabled = COALESCE((s.value #>> '{}')::boolean, false),
    provider = 'RAZORPAY',
    display_status = CASE
      WHEN COALESCE((s.value #>> '{}')::boolean, false) THEN 'ACTIVE'
      ELSE 'DISABLED'
    END,
    updated_at = CURRENT_TIMESTAMP
FROM system_settings s
WHERE s.key = 'enable_online_payments';
