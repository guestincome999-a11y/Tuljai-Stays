-- Replaced by google_maps_link (see 20260911173044_add_google_maps_link_to_lodges):
-- most owners/admins don't know their property's coordinates but can easily
-- share a Google Maps pin, so raw coordinate fields are no longer collected.
ALTER TABLE "lodges" DROP COLUMN IF EXISTS "latitude", DROP COLUMN IF EXISTS "longitude";
