-- Migration: add_dochub_autocreate_to_projects
-- Date: 2025-12-30
-- Description: Persist DocHub auto-create toggle + last run metadata on projects.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS dochub_autocreate_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dochub_autocreate_last_run_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS dochub_autocreate_last_error TEXT;

