-- Migration: add_dochub_provider_fields
-- Date: 2025-12-29
-- Description: Extends projects with DocHub provider settings (for future backend integration).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS dochub_provider TEXT,
  ADD COLUMN IF NOT EXISTS dochub_mode TEXT,
  ADD COLUMN IF NOT EXISTS dochub_root_id TEXT,
  ADD COLUMN IF NOT EXISTS dochub_root_name TEXT,
  ADD COLUMN IF NOT EXISTS dochub_drive_id TEXT,
  ADD COLUMN IF NOT EXISTS dochub_site_id TEXT,
  ADD COLUMN IF NOT EXISTS dochub_root_web_url TEXT,
  ADD COLUMN IF NOT EXISTS dochub_status TEXT DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS dochub_last_error TEXT;

