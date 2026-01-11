-- Adds Excel Merger PRO mirror URL into app_settings so only admins can change it.
-- Safe to run multiple times.

-- ALTER TABLE IF EXISTS public.app_settings
--   ADD COLUMN IF NOT EXISTS excel_merger_mirror_url text;

