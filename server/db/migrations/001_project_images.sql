-- Project images (cover + gallery). Binary bytes are never stored in
-- Postgres — only the served URL and the storage key needed to delete the
-- underlying file later (see server/src/lib/storage/).
CREATE TABLE IF NOT EXISTS project_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  is_cover BOOLEAN NOT NULL DEFAULT false,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_images_project_id ON project_images(project_id);

-- "At most one cover per project" is enforced in application logic
-- (server/src/routes/projects.js sets/unsets is_cover inside a transaction),
-- not a DB constraint — matches this schema's existing precedent of doing
-- invariants like this in route code rather than partial unique indexes.
