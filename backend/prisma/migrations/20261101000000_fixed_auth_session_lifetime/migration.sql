BEGIN;
-- Preserve the original login anchor. Never resurrect expired/revoked refresh tokens.
ALTER TABLE "user_sessions" ADD COLUMN "session_expires_at" TIMESTAMP(3);
UPDATE "user_sessions" SET "session_expires_at" = "created_at" + INTERVAL '180 days';
-- Keep the old application compatible while Render builds the replacement.
ALTER TABLE "user_sessions" ALTER COLUMN "session_expires_at" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '180 days');
ALTER TABLE "user_sessions" ALTER COLUMN "session_expires_at" SET NOT NULL;

-- Upgrade only still-valid sessions to the new policy, anchored to login.
-- Already expired tokens and revoked/inactive sessions stay unusable.
UPDATE "refresh_tokens" AS token
SET "expires_at" = session."session_expires_at"
FROM "user_sessions" AS session
WHERE session."refresh_token_id" = token."id"
  AND session."is_active" = true
  AND session."session_expires_at" > CURRENT_TIMESTAMP
  AND token."revoked_at" IS NULL
  AND token."expires_at" > CURRENT_TIMESTAMP;

COMMIT;
