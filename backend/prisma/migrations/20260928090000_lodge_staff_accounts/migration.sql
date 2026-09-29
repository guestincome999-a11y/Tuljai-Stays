-- Lodge staff accounts: adds a STAFF user role and a member_type column on
-- lodge_owners so admins can add front-desk/operations staff (in addition
-- to owners) who can log into the Owner App to manage check-in/check-out
-- and room status for their assigned lodge(s).

-- 1. New UserRole enum value.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STAFF';

-- 2. New enum distinguishing an owner row from a staff row in lodge_owners.
DO $$ BEGIN
    CREATE TYPE "LodgeMemberType" AS ENUM ('OWNER', 'STAFF');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. member_type column, defaulting existing rows to OWNER (every existing
--    lodge_owners row today is in fact an owner - staff didn't exist before).
ALTER TABLE "lodge_owners"
    ADD COLUMN IF NOT EXISTS "member_type" "LodgeMemberType" NOT NULL DEFAULT 'OWNER';

CREATE INDEX IF NOT EXISTS "lodge_owners_lodge_id_member_type_idx"
    ON "lodge_owners"("lodge_id", "member_type");
