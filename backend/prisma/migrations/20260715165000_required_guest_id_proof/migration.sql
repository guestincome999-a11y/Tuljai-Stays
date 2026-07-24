ALTER TABLE "booking_guests"
ADD COLUMN "id_proof_storage_path" TEXT,
ADD COLUMN "id_proof_original_name" TEXT,
ADD COLUMN "id_proof_mime_type" TEXT,
ADD COLUMN "id_proof_size_bytes" INTEGER;
