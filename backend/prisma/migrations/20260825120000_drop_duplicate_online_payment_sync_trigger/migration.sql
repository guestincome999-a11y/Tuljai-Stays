-- The system_settings_online_payment_sync trigger (added in
-- 20260819090000_sync_online_payment_setting) is a duplicate of
-- trg_sync_online_payment_setting (added later in
-- 20260819103000_sync_online_payment_toggle). Both execute the same
-- sync_online_payment_setting() function on every system_settings update,
-- so the sync ran twice per write. Drop the redundant older trigger and
-- keep the newer one, which is also the version referenced going forward.
DROP TRIGGER IF EXISTS system_settings_online_payment_sync ON "system_settings";
