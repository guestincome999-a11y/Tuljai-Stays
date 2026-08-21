-- Additive review-owner response storage. Existing reviews are untouched.
CREATE TABLE "review_owner_responses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "review_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "response" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_owner_responses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_owner_responses_review_id_key" UNIQUE ("review_id"),
  CONSTRAINT "review_owner_responses_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_owner_responses_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "review_owner_responses_owner_user_id_idx" ON "review_owner_responses"("owner_user_id");
CREATE INDEX "review_owner_responses_updated_at_idx" ON "review_owner_responses"("updated_at");
