-- Switches project cover/gallery images and generic project files from
-- local-disk / Cloudflare R2 storage to Cloudinary. The existing
-- `storage_key` TEXT column on both tables is repurposed to hold the
-- Cloudinary `public_id` instead of a local file path / R2 object key — no
-- schema change needed for that column, and the existing
-- delete-by-storage_key pattern in the routes still applies unchanged.
-- These two columns are new metadata Cloudinary returns on every upload.
ALTER TABLE project_images ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE project_images ADD COLUMN IF NOT EXISTS format TEXT;

ALTER TABLE project_files ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS format TEXT;
