-- Add geocoding columns to subcontractors and projects
ALTER TABLE subcontractors
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

-- Spatial indexes for efficient distance queries
CREATE INDEX IF NOT EXISTS idx_subcontractors_geo
  ON subcontractors (latitude, longitude)
  WHERE latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_geo
  ON projects (latitude, longitude)
  WHERE latitude IS NOT NULL;
