-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_CONFIRMED';

-- AlterTable
ALTER TABLE "auth_identities" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;
