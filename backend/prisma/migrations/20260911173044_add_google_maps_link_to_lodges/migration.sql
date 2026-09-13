-- Owner/admin-provided Google Maps share link, used by consuming apps for "get directions".
ALTER TABLE "lodges" ADD COLUMN IF NOT EXISTS "google_maps_link" TEXT;
