-- Restore the production control-plane state for the already implemented
-- online-payment and admin user-tracking features.

-- The admin setting is the authoritative user-facing switch used by the
-- payment service. Keep it public so the mobile apps can consume it.
INSERT INTO "system_settings" ("key", "value", "description", "is_public")
VALUES ('enable_online_payments', 'true'::jsonb, 'Online payments enabled', true)
ON CONFLICT ("key") DO UPDATE
SET "value" = 'true'::jsonb,
    "description" = 'Online payments enabled',
    "is_public" = true,
    "updated_at" = CURRENT_TIMESTAMP;

-- The payment subsystem also keeps its provider/display state. Both switches
-- must be active before a Razorpay order can be created.
INSERT INTO "payment_settings" ("online_payments_enabled", "provider", "display_status")
SELECT true, 'RAZORPAY', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM "payment_settings");

UPDATE "payment_settings"
SET "online_payments_enabled" = true,
    "provider" = 'RAZORPAY',
    "display_status" = 'ACTIVE',
    "updated_at" = CURRENT_TIMESTAMP;

-- Keep the platform feature flag consistent with the payment setting so the
-- admin Feature Flags screen does not report a contradictory state.
INSERT INTO "feature_flags" ("key", "enabled", "rollout_percentage", "description")
VALUES ('online_payments', true, 100, 'Online payment collection')
ON CONFLICT ("key") DO UPDATE
SET "enabled" = true,
    "rollout_percentage" = 100,
    "description" = 'Online payment collection',
    "updated_at" = CURRENT_TIMESTAMP;
