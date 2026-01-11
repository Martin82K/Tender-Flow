ALTER TABLE projects ADD COLUMN IF NOT EXISTS dochub_settings JSONB DEFAULT '{}'::jsonb;
