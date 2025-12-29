-- Migration: Add RLS policies to subcontractor_statuses table
-- Purpose: Enable admin-only management of contact statuses
-- Note: Table already exists from initial_schema, just adding RLS

-- Enable RLS on existing table
ALTER TABLE subcontractor_statuses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "subcontractor_statuses_select" ON subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_admin_insert" ON subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_admin_update" ON subcontractor_statuses;
DROP POLICY IF EXISTS "subcontractor_statuses_admin_delete" ON subcontractor_statuses;

-- Everyone can read statuses
CREATE POLICY "subcontractor_statuses_select" ON subcontractor_statuses 
  FOR SELECT USING (true);

-- Only admin can insert
CREATE POLICY "subcontractor_statuses_admin_insert" ON subcontractor_statuses 
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = 'martinkalkus82@gmail.com');

-- Only admin can update
CREATE POLICY "subcontractor_statuses_admin_update" ON subcontractor_statuses 
  FOR UPDATE USING (auth.jwt() ->> 'email' = 'martinkalkus82@gmail.com');

-- Only admin can delete
CREATE POLICY "subcontractor_statuses_admin_delete" ON subcontractor_statuses 
  FOR DELETE USING (auth.jwt() ->> 'email' = 'martinkalkus82@gmail.com');

-- Add sort_order column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subcontractor_statuses' AND column_name = 'sort_order') THEN
    ALTER TABLE subcontractor_statuses ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
END $$;

-- Insert default statuses if they don't exist
INSERT INTO subcontractor_statuses (id, label, color, sort_order) VALUES
  ('available', 'K dispozici', 'green', 1),
  ('busy', 'Zaneprázdněn', 'red', 2),
  ('waiting', 'Čeká', 'yellow', 3)
ON CONFLICT (id) DO NOTHING;
