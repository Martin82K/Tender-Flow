-- Legacy script (not used by Supabase migrations)
-- Original file moved from supabase/migrations because this repository uses a later baseline schema.

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL, -- Stores HTML content
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies (Row Level Security)
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users
CREATE POLICY "Enable read access for authenticated users" ON templates
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON templates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON templates
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON templates
    FOR DELETE USING (auth.role() = 'authenticated');

