CREATE TABLE "guest_id_proof_uploads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "contents" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "guest_id_proof_uploads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guest_id_proof_uploads_storage_path_key" ON "guest_id_proof_uploads"("storage_path");
CREATE INDEX "guest_id_proof_uploads_user_id_idx" ON "guest_id_proof_uploads"("user_id");
CREATE INDEX "guest_id_proof_uploads_deleted_at_idx" ON "guest_id_proof_uploads"("deleted_at");
