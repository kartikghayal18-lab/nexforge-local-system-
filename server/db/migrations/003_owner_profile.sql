-- Owner profile fields on the single `users` row. This is a single-owner
-- app (see users' 403-after-first-user rule in auth.js) so "owner profile"
-- is columns on that one row, not a separate table with its own FK — there
-- is never more than one profile to join against.
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT;
-- NULL means profile setup has not been completed yet (gates the frontend's
-- first-run setup screen). Set once every required field is present.
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;
