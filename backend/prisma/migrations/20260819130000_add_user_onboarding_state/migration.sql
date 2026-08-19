-- Track onboarding completion separately from the user's profile fields.
-- Existing accounts are marked complete so this migration does not interrupt
-- established users. Accounts created after this migration remain incomplete
-- until the pilgrim finishes the required onboarding form.
CREATE TABLE "user_onboarding_state" (
  "user_id" UUID NOT NULL,
  "completed_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_onboarding_state_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_onboarding_state_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "user_onboarding_state" ("user_id", "completed_at")
SELECT "id", CURRENT_TIMESTAMP
FROM "users"
ON CONFLICT ("user_id") DO NOTHING;
