-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PILGRIM', 'OWNER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'REGISTER', 'VERIFY_PHONE');

-- CreateEnum
CREATE TYPE "AppType" AS ENUM ('PILGRIM_APP', 'OWNER_APP', 'ADMIN_PANEL');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS', 'WEB', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('LODGE', 'BHAKT_NIWAS', 'DHARAMSHALA', 'HOTEL', 'HOMESTAY');

-- CreateEnum
CREATE TYPE "LodgeStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LodgeDocumentType" AS ENUM ('OWNER_ID', 'PAN', 'GST', 'BUSINESS_LICENSE', 'PROPERTY_PROOF', 'BANK_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "AmenityCategory" AS ENUM ('ROOM', 'PROPERTY', 'SAFETY', 'FAMILY', 'PARKING', 'FOOD', 'ACCESSIBILITY');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'PENDING_APPROVAL', 'CONFIRMED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('NORMAL', 'WEEKEND', 'FESTIVAL', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "PhotoCategory" AS ENUM ('COVER', 'EXTERIOR', 'RECEPTION', 'ROOM', 'BATHROOM', 'PARKING', 'AMENITY', 'OTHER');

-- CreateEnum
CREATE TYPE "PhotoApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'PENDING_OWNER_APPROVAL', 'ACCEPTED', 'REJECTED', 'QR_GENERATED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'ADVANCE_PAID', 'FULLY_PAID', 'PAY_AT_LODGE', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "GuestIdType" AS ENUM ('AADHAAR', 'PAN', 'VOTER_ID', 'PASSPORT', 'DRIVING_LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingLockStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'RELEASED');

-- CreateEnum
CREATE TYPE "QrTokenStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "QrScanResult" AS ENUM ('SUCCESS', 'INVALID', 'EXPIRED', 'USED', 'UNAUTHORIZED', 'BOOKING_NOT_FOUND', 'WRONG_LODGE', 'INVALID_STATUS');

-- CreateEnum
CREATE TYPE "GuestRegisterStatus" AS ENUM ('CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_REQUEST', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED', 'QR_GENERATED', 'CHECKIN_COMPLETED', 'CHECKOUT_COMPLETED', 'CHECKOUT_REMINDER', 'PHOTO_APPROVED', 'PHOTO_REJECTED', 'ADMIN_ANNOUNCEMENT', 'EMERGENCY_ALERT', 'REVIEW_RECEIVED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'SOCKET', 'EMAIL_OPTIONAL', 'WHATSAPP_OPTIONAL');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('GENERAL', 'EMERGENCY', 'TEMPLE_NOTICE', 'FESTIVAL', 'MAINTENANCE', 'OFFER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AnnouncementTargetAudience" AS ENUM ('ALL', 'PILGRIMS', 'OWNERS', 'ADMINS', 'LODGE_SPECIFIC', 'CITY_SPECIFIC');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED', 'REPORTED');

-- CreateEnum
CREATE TYPE "ReviewReportReason" AS ENUM ('FAKE', 'ABUSIVE', 'MISLEADING', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone_number" TEXT NOT NULL,
    "display_name" TEXT,
    "roles" "UserRole"[] DEFAULT ARRAY['PILGRIM']::"UserRole"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lodges" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "property_type" "PropertyType" NOT NULL,
    "status" "LodgeStatus" NOT NULL DEFAULT 'DRAFT',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "owner_user_id" UUID,
    "primary_phone" TEXT NOT NULL,
    "secondary_phone" TEXT,
    "whatsapp_number" TEXT,
    "email" TEXT,
    "distance_from_temple_meters" INTEGER,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "check_in_time" TEXT,
    "check_out_time" TEXT,
    "rules" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lodges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lodge_addresses" (
    "id" UUID NOT NULL,
    "lodge_id" UUID NOT NULL,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lodge_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lodge_owners" (
    "id" UUID NOT NULL,
    "lodge_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "owner_name" TEXT NOT NULL,
    "owner_phone" TEXT NOT NULL,
    "owner_email" TEXT,
    "role_title" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lodge_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lodge_documents" (
    "id" UUID NOT NULL,
    "lodge_id" UUID NOT NULL,
    "document_type" "LodgeDocumentType" NOT NULL,
    "document_number" TEXT,
    "file_url" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_by_user_id" UUID NOT NULL,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lodge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lodge_verification_logs" (
    "id" UUID NOT NULL,
    "lodge_id" UUID NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "notes" TEXT,
    "reviewed_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lodge_verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon_name" TEXT,
    "category" "AmenityCategory" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lodge_amenities" (
    "id" UUID NOT NULL,
    "lodge_id" UUID NOT NULL,
    "amenity_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lodge_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_types" (
    "id" UUID NOT NULL,
    "lodge_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "capacity_adults" INTEGER NOT NULL,
    "capacity_children" INTEGER NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "festival_price" DECIMAL(10,2),
    "total_rooms" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "lodge_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "room_number" TEXT NOT NULL,
    "floor" TEXT,
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_pricing" (
    "id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "price_type" "PriceType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_availability" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "RoomStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lodge_photos" (
    "id" UUID NOT NULL,
    "lodge_id" UUID NOT NULL,
    "room_type_id" UUID,
    "room_id" UUID,
    "uploaded_by_user_id" UUID NOT NULL,
    "category" "PhotoCategory" NOT NULL,
    "file_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "approval_status" "PhotoApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lodge_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "booking_code" TEXT NOT NULL,
    "pilgrim_user_id" UUID NOT NULL,
    "lodge_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "room_id" UUID,
    "city_id" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_OWNER_APPROVAL',
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT NOT NULL,
    "alternate_phone" TEXT,
    "guest_email" TEXT,
    "guest_address" TEXT,
    "number_of_adults" INTEGER NOT NULL,
    "number_of_children" INTEGER NOT NULL,
    "total_guests" INTEGER NOT NULL,
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "expected_check_in_time" TEXT,
    "expected_check_out_time" TEXT,
    "special_request" TEXT,
    "total_amount" DECIMAL(10,2),
    "advance_amount" DECIMAL(10,2),
    "balance_amount" DECIMAL(10,2),
    "commission_amount" DECIMAL(10,2),
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PAY_AT_LODGE',
    "owner_response_deadline" TIMESTAMP(3),
    "accepted_by_user_id" UUID,
    "rejected_by_user_id" UUID,
    "cancellation_reason" TEXT,
    "rejected_reason" TEXT,
    "checked_in_at" TIMESTAMP(3),
    "checked_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_guests" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "phone" TEXT,
    "id_type" "GuestIdType",
    "id_number" TEXT,
    "is_primary_guest" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "booking_guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_locks" (
    "id" UUID NOT NULL,
    "lock_code" TEXT NOT NULL,
    "pilgrim_user_id" UUID,
    "lodge_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "room_id" UUID,
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "BookingLockStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_history" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "from_status" "BookingStatus",
    "to_status" "BookingStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_status_history" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "from_status" "RoomStatus" NOT NULL,
    "to_status" "RoomStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "booking_id" UUID,
    "actor_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_qr_tokens" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by_user_id" UUID,
    "used_device_id" TEXT,
    "scan_ip_address" TEXT,
    "scan_user_agent" TEXT,
    "status" "QrTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_qr_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_scan_logs" (
    "id" UUID NOT NULL,
    "booking_id" UUID,
    "qr_token_id" UUID,
    "scanned_by_user_id" UUID,
    "lodge_id" UUID,
    "result" "QrScanResult" NOT NULL,
    "failure_reason" TEXT,
    "device_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_scan_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_register" (
    "id" UUID NOT NULL,
    "register_code" TEXT NOT NULL,
    "booking_id" UUID NOT NULL,
    "lodge_id" UUID NOT NULL,
    "room_id" UUID,
    "room_type_id" UUID NOT NULL,
    "pilgrim_user_id" UUID NOT NULL,
    "primary_guest_name" TEXT NOT NULL,
    "primary_guest_phone" TEXT NOT NULL,
    "alternate_phone" TEXT,
    "guest_email" TEXT,
    "guest_address" TEXT,
    "number_of_adults" INTEGER NOT NULL,
    "number_of_children" INTEGER NOT NULL,
    "total_guests" INTEGER NOT NULL,
    "government_id_type" "GuestIdType",
    "government_id_number" TEXT,
    "id_verified" BOOLEAN NOT NULL DEFAULT false,
    "booking_code" TEXT NOT NULL,
    "qr_token_id" UUID,
    "check_in_at" TIMESTAMP(3) NOT NULL,
    "expected_checkout_at" TIMESTAMP(3),
    "actual_checkout_at" TIMESTAMP(3),
    "status" "GuestRegisterStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "owner_notes" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "guest_register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_id_documents" (
    "id" UUID NOT NULL,
    "guest_register_id" UUID NOT NULL,
    "document_type" "GuestIdType" NOT NULL,
    "document_number" TEXT NOT NULL,
    "document_holder_name" TEXT,
    "verified_by_user_id" UUID,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "guest_id_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "register_audit_logs" (
    "id" UUID NOT NULL,
    "guest_register_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "register_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_user_id" UUID,
    "recipient_role" "UserRole",
    "lodge_id" UUID,
    "booking_id" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "data" JSONB,
    "read_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title_template" TEXT NOT NULL,
    "body_template" TEXT NOT NULL,
    "default_priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_delivery_logs" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "user_id" UUID,
    "device_token_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "AnnouncementCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "target_audience" "AnnouncementTargetAudience" NOT NULL,
    "target_city_id" UUID,
    "target_lodge_id" UUID,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "lodge_id" UUID NOT NULL,
    "room_type_id" UUID,
    "pilgrim_user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "cleanliness_rating" INTEGER,
    "location_rating" INTEGER,
    "service_rating" INTEGER,
    "value_rating" INTEGER,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "is_verified_stay" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "reported_by_user_id" UUID NOT NULL,
    "reason" "ReviewReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReviewReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "rollout_percentage" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "city_id" UUID,
    "lodge_id" UUID,
    "bookings_count" INTEGER NOT NULL DEFAULT 0,
    "check_ins_count" INTEGER NOT NULL DEFAULT 0,
    "check_outs_count" INTEGER NOT NULL DEFAULT 0,
    "revenue_estimate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commission_estimate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_requests" (
    "id" UUID NOT NULL,
    "phone_number" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'UNKNOWN',
    "app_type" "AppType" NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "fcm_token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'UNKNOWN',
    "app_type" "AppType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE INDEX "users_phone_number_idx" ON "users"("phone_number");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE INDEX "cities_slug_idx" ON "cities"("slug");

-- CreateIndex
CREATE INDEX "cities_is_active_idx" ON "cities"("is_active");

-- CreateIndex
CREATE INDEX "cities_deleted_at_idx" ON "cities"("deleted_at");

-- CreateIndex
CREATE INDEX "lodges_city_id_idx" ON "lodges"("city_id");

-- CreateIndex
CREATE INDEX "lodges_owner_user_id_idx" ON "lodges"("owner_user_id");

-- CreateIndex
CREATE INDEX "lodges_status_verification_status_is_active_idx" ON "lodges"("status", "verification_status", "is_active");

-- CreateIndex
CREATE INDEX "lodges_deleted_at_idx" ON "lodges"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "lodges_city_id_slug_key" ON "lodges"("city_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "lodge_addresses_lodge_id_key" ON "lodge_addresses"("lodge_id");

-- CreateIndex
CREATE INDEX "lodge_owners_lodge_id_is_primary_idx" ON "lodge_owners"("lodge_id", "is_primary");

-- CreateIndex
CREATE INDEX "lodge_owners_user_id_idx" ON "lodge_owners"("user_id");

-- CreateIndex
CREATE INDEX "lodge_owners_deleted_at_idx" ON "lodge_owners"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "lodge_owners_lodge_id_user_id_key" ON "lodge_owners"("lodge_id", "user_id");

-- CreateIndex
CREATE INDEX "lodge_documents_lodge_id_idx" ON "lodge_documents"("lodge_id");

-- CreateIndex
CREATE INDEX "lodge_documents_verification_status_idx" ON "lodge_documents"("verification_status");

-- CreateIndex
CREATE INDEX "lodge_documents_deleted_at_idx" ON "lodge_documents"("deleted_at");

-- CreateIndex
CREATE INDEX "lodge_verification_logs_lodge_id_idx" ON "lodge_verification_logs"("lodge_id");

-- CreateIndex
CREATE INDEX "lodge_verification_logs_reviewed_by_user_id_idx" ON "lodge_verification_logs"("reviewed_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_slug_key" ON "amenities"("slug");

-- CreateIndex
CREATE INDEX "amenities_category_idx" ON "amenities"("category");

-- CreateIndex
CREATE INDEX "amenities_is_active_idx" ON "amenities"("is_active");

-- CreateIndex
CREATE INDEX "amenities_deleted_at_idx" ON "amenities"("deleted_at");

-- CreateIndex
CREATE INDEX "lodge_amenities_amenity_id_idx" ON "lodge_amenities"("amenity_id");

-- CreateIndex
CREATE UNIQUE INDEX "lodge_amenities_lodge_id_amenity_id_key" ON "lodge_amenities"("lodge_id", "amenity_id");

-- CreateIndex
CREATE INDEX "room_types_lodge_id_idx" ON "room_types"("lodge_id");

-- CreateIndex
CREATE INDEX "room_types_is_active_idx" ON "room_types"("is_active");

-- CreateIndex
CREATE INDEX "room_types_deleted_at_idx" ON "room_types"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "room_types_lodge_id_slug_key" ON "room_types"("lodge_id", "slug");

-- CreateIndex
CREATE INDEX "rooms_room_type_id_idx" ON "rooms"("room_type_id");

-- CreateIndex
CREATE INDEX "rooms_status_idx" ON "rooms"("status");

-- CreateIndex
CREATE INDEX "rooms_deleted_at_idx" ON "rooms"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_lodge_id_room_number_key" ON "rooms"("lodge_id", "room_number");

-- CreateIndex
CREATE INDEX "room_pricing_date_idx" ON "room_pricing"("date");

-- CreateIndex
CREATE UNIQUE INDEX "room_pricing_room_type_id_date_key" ON "room_pricing"("room_type_id", "date");

-- CreateIndex
CREATE INDEX "room_availability_date_idx" ON "room_availability"("date");

-- CreateIndex
CREATE INDEX "room_availability_status_idx" ON "room_availability"("status");

-- CreateIndex
CREATE UNIQUE INDEX "room_availability_room_id_date_key" ON "room_availability"("room_id", "date");

-- CreateIndex
CREATE INDEX "lodge_photos_lodge_id_idx" ON "lodge_photos"("lodge_id");

-- CreateIndex
CREATE INDEX "lodge_photos_room_type_id_idx" ON "lodge_photos"("room_type_id");

-- CreateIndex
CREATE INDEX "lodge_photos_room_id_idx" ON "lodge_photos"("room_id");

-- CreateIndex
CREATE INDEX "lodge_photos_approval_status_idx" ON "lodge_photos"("approval_status");

-- CreateIndex
CREATE INDEX "lodge_photos_deleted_at_idx" ON "lodge_photos"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_code_key" ON "bookings"("booking_code");

-- CreateIndex
CREATE INDEX "bookings_pilgrim_user_id_idx" ON "bookings"("pilgrim_user_id");

-- CreateIndex
CREATE INDEX "bookings_lodge_id_status_idx" ON "bookings"("lodge_id", "status");

-- CreateIndex
CREATE INDEX "bookings_room_type_id_idx" ON "bookings"("room_type_id");

-- CreateIndex
CREATE INDEX "bookings_room_id_idx" ON "bookings"("room_id");

-- CreateIndex
CREATE INDEX "bookings_city_id_idx" ON "bookings"("city_id");

-- CreateIndex
CREATE INDEX "bookings_check_in_date_check_out_date_idx" ON "bookings"("check_in_date", "check_out_date");

-- CreateIndex
CREATE INDEX "bookings_created_at_idx" ON "bookings"("created_at");

-- CreateIndex
CREATE INDEX "bookings_status_created_at_idx" ON "bookings"("status", "created_at");

-- CreateIndex
CREATE INDEX "bookings_city_id_created_at_idx" ON "bookings"("city_id", "created_at");

-- CreateIndex
CREATE INDEX "bookings_owner_response_deadline_idx" ON "bookings"("owner_response_deadline");

-- CreateIndex
CREATE INDEX "bookings_deleted_at_idx" ON "bookings"("deleted_at");

-- CreateIndex
CREATE INDEX "booking_guests_booking_id_idx" ON "booking_guests"("booking_id");

-- CreateIndex
CREATE INDEX "booking_guests_deleted_at_idx" ON "booking_guests"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_locks_lock_code_key" ON "booking_locks"("lock_code");

-- CreateIndex
CREATE INDEX "booking_locks_pilgrim_user_id_idx" ON "booking_locks"("pilgrim_user_id");

-- CreateIndex
CREATE INDEX "booking_locks_lodge_id_room_type_id_idx" ON "booking_locks"("lodge_id", "room_type_id");

-- CreateIndex
CREATE INDEX "booking_locks_room_id_idx" ON "booking_locks"("room_id");

-- CreateIndex
CREATE INDEX "booking_locks_check_in_date_check_out_date_idx" ON "booking_locks"("check_in_date", "check_out_date");

-- CreateIndex
CREATE INDEX "booking_locks_expires_at_idx" ON "booking_locks"("expires_at");

-- CreateIndex
CREATE INDEX "booking_locks_status_idx" ON "booking_locks"("status");

-- CreateIndex
CREATE INDEX "booking_history_booking_id_idx" ON "booking_history"("booking_id");

-- CreateIndex
CREATE INDEX "booking_history_actor_user_id_idx" ON "booking_history"("actor_user_id");

-- CreateIndex
CREATE INDEX "booking_history_to_status_idx" ON "booking_history"("to_status");

-- CreateIndex
CREATE INDEX "room_status_history_room_id_idx" ON "room_status_history"("room_id");

-- CreateIndex
CREATE INDEX "room_status_history_booking_id_idx" ON "room_status_history"("booking_id");

-- CreateIndex
CREATE INDEX "room_status_history_actor_user_id_idx" ON "room_status_history"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_qr_tokens_token_hash_key" ON "booking_qr_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "booking_qr_tokens_booking_id_idx" ON "booking_qr_tokens"("booking_id");

-- CreateIndex
CREATE INDEX "booking_qr_tokens_expires_at_idx" ON "booking_qr_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "booking_qr_tokens_status_idx" ON "booking_qr_tokens"("status");

-- CreateIndex
CREATE INDEX "qr_scan_logs_booking_id_idx" ON "qr_scan_logs"("booking_id");

-- CreateIndex
CREATE INDEX "qr_scan_logs_qr_token_id_idx" ON "qr_scan_logs"("qr_token_id");

-- CreateIndex
CREATE INDEX "qr_scan_logs_scanned_by_user_id_idx" ON "qr_scan_logs"("scanned_by_user_id");

-- CreateIndex
CREATE INDEX "qr_scan_logs_lodge_id_idx" ON "qr_scan_logs"("lodge_id");

-- CreateIndex
CREATE INDEX "qr_scan_logs_result_idx" ON "qr_scan_logs"("result");

-- CreateIndex
CREATE INDEX "qr_scan_logs_created_at_idx" ON "qr_scan_logs"("created_at");

-- CreateIndex
CREATE INDEX "qr_scan_logs_result_created_at_idx" ON "qr_scan_logs"("result", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "guest_register_register_code_key" ON "guest_register"("register_code");

-- CreateIndex
CREATE UNIQUE INDEX "guest_register_booking_id_key" ON "guest_register"("booking_id");

-- CreateIndex
CREATE INDEX "guest_register_lodge_id_status_idx" ON "guest_register"("lodge_id", "status");

-- CreateIndex
CREATE INDEX "guest_register_room_id_idx" ON "guest_register"("room_id");

-- CreateIndex
CREATE INDEX "guest_register_room_type_id_idx" ON "guest_register"("room_type_id");

-- CreateIndex
CREATE INDEX "guest_register_pilgrim_user_id_idx" ON "guest_register"("pilgrim_user_id");

-- CreateIndex
CREATE INDEX "guest_register_booking_code_idx" ON "guest_register"("booking_code");

-- CreateIndex
CREATE INDEX "guest_register_check_in_at_idx" ON "guest_register"("check_in_at");

-- CreateIndex
CREATE INDEX "guest_register_deleted_at_idx" ON "guest_register"("deleted_at");

-- CreateIndex
CREATE INDEX "guest_id_documents_guest_register_id_idx" ON "guest_id_documents"("guest_register_id");

-- CreateIndex
CREATE INDEX "guest_id_documents_verified_by_user_id_idx" ON "guest_id_documents"("verified_by_user_id");

-- CreateIndex
CREATE INDEX "guest_id_documents_deleted_at_idx" ON "guest_id_documents"("deleted_at");

-- CreateIndex
CREATE INDEX "register_audit_logs_guest_register_id_idx" ON "register_audit_logs"("guest_register_id");

-- CreateIndex
CREATE INDEX "register_audit_logs_actor_user_id_idx" ON "register_audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "register_audit_logs_action_idx" ON "register_audit_logs"("action");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_read_at_idx" ON "notifications"("recipient_user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_role_idx" ON "notifications"("recipient_role");

-- CreateIndex
CREATE INDEX "notifications_lodge_id_idx" ON "notifications"("lodge_id");

-- CreateIndex
CREATE INDEX "notifications_booking_id_idx" ON "notifications"("booking_id");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_deleted_at_idx" ON "notifications"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_type_key" ON "notification_templates"("type");

-- CreateIndex
CREATE INDEX "notification_templates_is_active_idx" ON "notification_templates"("is_active");

-- CreateIndex
CREATE INDEX "notification_templates_deleted_at_idx" ON "notification_templates"("deleted_at");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_notification_id_idx" ON "notification_delivery_logs"("notification_id");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_user_id_idx" ON "notification_delivery_logs"("user_id");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_device_token_id_idx" ON "notification_delivery_logs"("device_token_id");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_status_idx" ON "notification_delivery_logs"("status");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_status_created_at_idx" ON "notification_delivery_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "announcements_target_audience_idx" ON "announcements"("target_audience");

-- CreateIndex
CREATE INDEX "announcements_target_city_id_idx" ON "announcements"("target_city_id");

-- CreateIndex
CREATE INDEX "announcements_target_lodge_id_idx" ON "announcements"("target_lodge_id");

-- CreateIndex
CREATE INDEX "announcements_is_active_idx" ON "announcements"("is_active");

-- CreateIndex
CREATE INDEX "announcements_category_is_active_idx" ON "announcements"("category", "is_active");

-- CreateIndex
CREATE INDEX "announcements_starts_at_expires_at_idx" ON "announcements"("starts_at", "expires_at");

-- CreateIndex
CREATE INDEX "announcements_created_at_idx" ON "announcements"("created_at");

-- CreateIndex
CREATE INDEX "announcements_deleted_at_idx" ON "announcements"("deleted_at");

-- CreateIndex
CREATE INDEX "announcement_reads_user_id_idx" ON "announcement_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_announcement_id_user_id_key" ON "announcement_reads"("announcement_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_notification_type_key" ON "notification_preferences"("user_id", "notification_type");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "reviews_lodge_id_status_idx" ON "reviews"("lodge_id", "status");

-- CreateIndex
CREATE INDEX "reviews_pilgrim_user_id_idx" ON "reviews"("pilgrim_user_id");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "reviews_deleted_at_idx" ON "reviews"("deleted_at");

-- CreateIndex
CREATE INDEX "review_reports_review_id_idx" ON "review_reports"("review_id");

-- CreateIndex
CREATE INDEX "review_reports_reported_by_user_id_idx" ON "review_reports"("reported_by_user_id");

-- CreateIndex
CREATE INDEX "review_reports_status_idx" ON "review_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_is_public_idx" ON "system_settings"("is_public");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_enabled_idx" ON "feature_flags"("enabled");

-- CreateIndex
CREATE INDEX "analytics_daily_date_idx" ON "analytics_daily"("date");

-- CreateIndex
CREATE INDEX "analytics_daily_city_id_idx" ON "analytics_daily"("city_id");

-- CreateIndex
CREATE INDEX "analytics_daily_lodge_id_idx" ON "analytics_daily"("lodge_id");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_date_city_id_lodge_id_key" ON "analytics_daily"("date", "city_id", "lodge_id");

-- CreateIndex
CREATE INDEX "otp_requests_phone_number_purpose_idx" ON "otp_requests"("phone_number", "purpose");

-- CreateIndex
CREATE INDEX "otp_requests_expires_at_idx" ON "otp_requests"("expires_at");

-- CreateIndex
CREATE INDEX "otp_requests_consumed_at_idx" ON "otp_requests"("consumed_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_device_id_idx" ON "refresh_tokens"("device_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_revoked_at_idx" ON "refresh_tokens"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_id_key" ON "user_sessions"("refresh_token_id");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_device_id_idx" ON "user_sessions"("device_id");

-- CreateIndex
CREATE INDEX "user_sessions_app_type_idx" ON "user_sessions"("app_type");

-- CreateIndex
CREATE INDEX "user_sessions_is_active_idx" ON "user_sessions"("is_active");

-- CreateIndex
CREATE INDEX "device_tokens_fcm_token_idx" ON "device_tokens"("fcm_token");

-- CreateIndex
CREATE INDEX "device_tokens_is_active_idx" ON "device_tokens"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_user_id_device_id_app_type_key" ON "device_tokens"("user_id", "device_id", "app_type");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "lodges" ADD CONSTRAINT "lodges_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodges" ADD CONSTRAINT "lodges_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_addresses" ADD CONSTRAINT "lodge_addresses_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_owners" ADD CONSTRAINT "lodge_owners_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_owners" ADD CONSTRAINT "lodge_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_documents" ADD CONSTRAINT "lodge_documents_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_documents" ADD CONSTRAINT "lodge_documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_documents" ADD CONSTRAINT "lodge_documents_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_verification_logs" ADD CONSTRAINT "lodge_verification_logs_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_verification_logs" ADD CONSTRAINT "lodge_verification_logs_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_amenities" ADD CONSTRAINT "lodge_amenities_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_amenities" ADD CONSTRAINT "lodge_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_pricing" ADD CONSTRAINT "room_pricing_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_availability" ADD CONSTRAINT "room_availability_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_photos" ADD CONSTRAINT "lodge_photos_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_photos" ADD CONSTRAINT "lodge_photos_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_photos" ADD CONSTRAINT "lodge_photos_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_photos" ADD CONSTRAINT "lodge_photos_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodge_photos" ADD CONSTRAINT "lodge_photos_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pilgrim_user_id_fkey" FOREIGN KEY ("pilgrim_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rejected_by_user_id_fkey" FOREIGN KEY ("rejected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_guests" ADD CONSTRAINT "booking_guests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_locks" ADD CONSTRAINT "booking_locks_pilgrim_user_id_fkey" FOREIGN KEY ("pilgrim_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_locks" ADD CONSTRAINT "booking_locks_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_locks" ADD CONSTRAINT "booking_locks_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_locks" ADD CONSTRAINT "booking_locks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_status_history" ADD CONSTRAINT "room_status_history_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_status_history" ADD CONSTRAINT "room_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_status_history" ADD CONSTRAINT "room_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_qr_tokens" ADD CONSTRAINT "booking_qr_tokens_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_qr_tokens" ADD CONSTRAINT "booking_qr_tokens_used_by_user_id_fkey" FOREIGN KEY ("used_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scan_logs" ADD CONSTRAINT "qr_scan_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scan_logs" ADD CONSTRAINT "qr_scan_logs_qr_token_id_fkey" FOREIGN KEY ("qr_token_id") REFERENCES "booking_qr_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scan_logs" ADD CONSTRAINT "qr_scan_logs_scanned_by_user_id_fkey" FOREIGN KEY ("scanned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scan_logs" ADD CONSTRAINT "qr_scan_logs_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_register" ADD CONSTRAINT "guest_register_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_register" ADD CONSTRAINT "guest_register_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_register" ADD CONSTRAINT "guest_register_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_register" ADD CONSTRAINT "guest_register_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_register" ADD CONSTRAINT "guest_register_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_register" ADD CONSTRAINT "guest_register_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_register" ADD CONSTRAINT "guest_register_qr_token_id_fkey" FOREIGN KEY ("qr_token_id") REFERENCES "booking_qr_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_id_documents" ADD CONSTRAINT "guest_id_documents_guest_register_id_fkey" FOREIGN KEY ("guest_register_id") REFERENCES "guest_register"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_id_documents" ADD CONSTRAINT "guest_id_documents_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_audit_logs" ADD CONSTRAINT "register_audit_logs_guest_register_id_fkey" FOREIGN KEY ("guest_register_id") REFERENCES "guest_register"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_audit_logs" ADD CONSTRAINT "register_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_device_token_id_fkey" FOREIGN KEY ("device_token_id") REFERENCES "device_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_city_id_fkey" FOREIGN KEY ("target_city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_lodge_id_fkey" FOREIGN KEY ("target_lodge_id") REFERENCES "lodges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_pilgrim_user_id_fkey" FOREIGN KEY ("pilgrim_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_lodge_id_fkey" FOREIGN KEY ("lodge_id") REFERENCES "lodges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_refresh_token_id_fkey" FOREIGN KEY ("refresh_token_id") REFERENCES "refresh_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
