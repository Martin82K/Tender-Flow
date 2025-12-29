-- Migration: add_dochub_to_projects
-- Date: 2025-12-29
-- Description: Adds DocHub configuration fields to projects.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS dochub_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dochub_root_link TEXT,
  ADD COLUMN IF NOT EXISTS dochub_structure_version INTEGER DEFAULT 1;

