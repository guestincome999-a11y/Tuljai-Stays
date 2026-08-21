-- Tuljai Stays Phase 1–5 additive platform foundations.
-- Existing booking, payment, commission and ledger rows are untouched.

CREATE TABLE IF NOT EXISTS "review_owner_responses" (
  "review_id" UUID PRIMARY KEY REFERENCES "reviews"("id") ON DELETE CASCADE,
  "owner_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "response" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "staff_role_assignments" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL CHECK ("role" IN ('FINANCE_ADMIN','OPERATIONS_MANAGER','SUPPORT_EXECUTIVE','PHOTO_REVIEWER','ANALYST')),
  "assigned_by_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "staff_role_assignments_role_idx" ON "staff_role_assignments"("role");

CREATE TABLE IF NOT EXISTS "admin_totp_credentials" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "secret_encrypted" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "last_verified_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id" UUID PRIMARY KEY,
  "code" VARCHAR(32) NOT NULL UNIQUE,
  "discount_type" TEXT NOT NULL CHECK ("discount_type" IN ('FLAT','PERCENTAGE')),
  "discount_value" NUMERIC(10,2) NOT NULL CHECK ("discount_value" > 0),
  "starts_at" TIMESTAMPTZ NOT NULL,
  "ends_at" TIMESTAMPTZ NOT NULL,
  "usage_limit" INTEGER CHECK ("usage_limit" IS NULL OR "usage_limit" > 0),
  "usage_count" INTEGER NOT NULL DEFAULT 0 CHECK ("usage_count" >= 0),
  "per_user_limit" INTEGER NOT NULL DEFAULT 1 CHECK ("per_user_limit" > 0),
  "lodge_id" UUID REFERENCES "lodges"("id") ON DELETE SET NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("ends_at" > "starts_at"),
  CHECK ("discount_type" <> 'PERCENTAGE' OR "discount_value" <= 100)
);
CREATE INDEX IF NOT EXISTS "promo_codes_validity_idx" ON "promo_codes"("active","starts_at","ends_at");
CREATE INDEX IF NOT EXISTS "promo_codes_lodge_idx" ON "promo_codes"("lodge_id");

CREATE TABLE IF NOT EXISTS "promo_redemptions" (
  "id" UUID PRIMARY KEY,
  "promo_code_id" UUID NOT NULL REFERENCES "promo_codes"("id") ON DELETE RESTRICT,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "booking_id" UUID REFERENCES "bookings"("id") ON DELETE SET NULL,
  "discount_amount" NUMERIC(10,2) NOT NULL CHECK ("discount_amount" >= 0),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "promo_redemptions_code_idx" ON "promo_redemptions"("promo_code_id");
CREATE INDEX IF NOT EXISTS "promo_redemptions_user_idx" ON "promo_redemptions"("user_id");

CREATE TABLE IF NOT EXISTS "festival_pricing_rules" (
  "id" UUID PRIMARY KEY,
  "lodge_id" UUID NOT NULL REFERENCES "lodges"("id") ON DELETE CASCADE,
  "room_type_id" UUID REFERENCES "room_types"("id") ON DELETE CASCADE,
  "starts_at" DATE NOT NULL,
  "ends_at" DATE NOT NULL,
  "price_override" NUMERIC(10,2),
  "price_multiplier" NUMERIC(8,4),
  "minimum_stay_nights" INTEGER NOT NULL DEFAULT 1 CHECK ("minimum_stay_nights" > 0),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("ends_at" >= "starts_at"),
  CHECK (("price_override" IS NOT NULL) OR ("price_multiplier" IS NOT NULL)),
  CHECK ("price_multiplier" IS NULL OR "price_multiplier" > 0)
);
CREATE INDEX IF NOT EXISTS "festival_pricing_rules_lookup_idx" ON "festival_pricing_rules"("lodge_id","room_type_id","starts_at","ends_at","active");

CREATE TABLE IF NOT EXISTS "cancellation_policies" (
  "id" UUID PRIMARY KEY,
  "lodge_id" UUID REFERENCES "lodges"("id") ON DELETE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "policy_type" TEXT NOT NULL CHECK ("policy_type" IN ('FREE_CANCELLATION','PARTIAL','NON_REFUNDABLE')),
  "free_cancel_hours" INTEGER NOT NULL DEFAULT 0 CHECK ("free_cancel_hours" >= 0),
  "partial_refund_percent" NUMERIC(5,2) CHECK ("partial_refund_percent" IS NULL OR ("partial_refund_percent" >= 0 AND "partial_refund_percent" <= 100)),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "cancellation_policies_lodge_idx" ON "cancellation_policies"("lodge_id","active");

CREATE TABLE IF NOT EXISTS "owner_bank_details" (
  "id" UUID PRIMARY KEY,
  "owner_user_id" UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "account_holder_name" VARCHAR(120) NOT NULL,
  "bank_name" VARCHAR(120) NOT NULL,
  "encrypted_account_number" TEXT NOT NULL,
  "account_last4" VARCHAR(4) NOT NULL,
  "ifsc" VARCHAR(11) NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" UUID PRIMARY KEY,
  "requester_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "requester_role" TEXT NOT NULL CHECK ("requester_role" IN ('PILGRIM','OWNER')),
  "subject" VARCHAR(160) NOT NULL,
  "category" VARCHAR(60) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED')),
  "priority" TEXT NOT NULL DEFAULT 'NORMAL' CHECK ("priority" IN ('LOW','NORMAL','HIGH','URGENT')),
  "assigned_to_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "support_tickets_queue_idx" ON "support_tickets"("status","priority","updated_at");
CREATE INDEX IF NOT EXISTS "support_tickets_requester_idx" ON "support_tickets"("requester_user_id","created_at");

CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
  "id" UUID PRIMARY KEY,
  "ticket_id" UUID NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "author_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_idx" ON "support_ticket_messages"("ticket_id","created_at");

CREATE TABLE IF NOT EXISTS "booking_conversations" (
  "id" UUID PRIMARY KEY,
  "booking_id" UUID NOT NULL UNIQUE REFERENCES "bookings"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "booking_messages" (
  "id" UUID PRIMARY KEY,
  "conversation_id" UUID NOT NULL REFERENCES "booking_conversations"("id") ON DELETE CASCADE,
  "sender_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "booking_messages_conversation_idx" ON "booking_messages"("conversation_id","created_at");

CREATE TABLE IF NOT EXISTS "account_flags" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "flag_type" TEXT NOT NULL CHECK ("flag_type" IN ('BAN','BLOCK')),
  "reason" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cleared_by_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "cleared_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "account_flags_active_idx" ON "account_flags"("user_id","active","flag_type");

CREATE TABLE IF NOT EXISTS "data_requests" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "request_type" TEXT NOT NULL CHECK ("request_type" IN ('EXPORT','DELETION')),
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','IN_REVIEW','COMPLETED','REJECTED')),
  "reason" TEXT,
  "reviewed_by_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" TIMESTAMPTZ,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "data_requests_queue_idx" ON "data_requests"("status","created_at");
CREATE INDEX IF NOT EXISTS "data_requests_user_idx" ON "data_requests"("user_id","created_at");

CREATE TABLE IF NOT EXISTS "booking_tax_details" (
  "booking_id" UUID PRIMARY KEY REFERENCES "bookings"("id") ON DELETE CASCADE,
  "taxable_amount" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "tax_rate" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "tax_amount" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "gstin" VARCHAR(15),
  "invoice_number" VARCHAR(50) UNIQUE,
  "invoice_issued_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
