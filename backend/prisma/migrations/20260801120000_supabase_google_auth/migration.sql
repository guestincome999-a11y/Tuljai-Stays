-- Allow pilgrims authenticated through Google to register before adding a mobile number.
ALTER TABLE "users" ALTER COLUMN "phone_number" DROP NOT NULL;

CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');

CREATE TABLE "auth_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_subject" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_identities_provider_provider_subject_key"
ON "auth_identities"("provider", "provider_subject");

CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");
CREATE INDEX "auth_identities_email_idx" ON "auth_identities"("email");

ALTER TABLE "auth_identities"
ADD CONSTRAINT "auth_identities_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
