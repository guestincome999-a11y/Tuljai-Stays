-- Owner App password authentication: adds a PASSWORD auth provider, a
-- password hash column on auth_identities, a canonical login email on
-- users, and a password_reset_tokens table for the forgot-password flow.

-- 1. New AuthProvider enum value.
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'PASSWORD';

-- 2. Password hash storage on auth_identities (scrypt "salt:hash" hex,
--    only ever populated when provider = PASSWORD).
ALTER TABLE "auth_identities" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;

-- 3. Canonical login email on users, used as the owner-app password-login
--    identifier. Distinct from auth_identities.email (provider-supplied).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");

-- 4. Password reset tokens (mirrors the otp_requests pattern: only the
--    sha256 hash of the raw token is ever stored).
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key"
    ON "password_reset_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx"
    ON "password_reset_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_at_idx"
    ON "password_reset_tokens"("expires_at");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_consumed_at_idx"
    ON "password_reset_tokens"("consumed_at");

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. One-time backfill: give existing OWNER-role users a login email from
--    the email they already supplied when registering their lodge, so they
--    can use "Forgot password" immediately after this deploys instead of
--    being locked out. Prefers their primary lodge's owner_email, falling
--    back to any lodge they're attached to. Never overwrites an existing
--    users.email, and skips values that would collide with another user's
--    email (kept NULL; those owners need an email set manually).
WITH ranked_owner_emails AS (
    SELECT
        lo.user_id,
        lower(trim(lo.owner_email)) AS email,
        ROW_NUMBER() OVER (
            PARTITION BY lo.user_id
            ORDER BY lo.is_primary DESC, lo.created_at ASC
        ) AS rank
    FROM "lodge_owners" lo
    WHERE lo.owner_email IS NOT NULL
      AND trim(lo.owner_email) <> ''
      AND lo.deleted_at IS NULL
),
candidate AS (
    SELECT user_id, email
    FROM ranked_owner_emails
    WHERE rank = 1
),
email_counts AS (
    SELECT email, COUNT(*) AS occurrences
    FROM candidate
    GROUP BY email
),
deduped AS (
    SELECT c.user_id, c.email
    FROM candidate c
    JOIN email_counts ec ON ec.email = c.email
    WHERE ec.occurrences = 1
)
UPDATE "users" u
SET "email" = d.email
FROM deduped d
WHERE u.id = d.user_id
  AND u.email IS NULL
  AND 'OWNER' = ANY(u.roles);
