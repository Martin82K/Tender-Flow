-- Migration: add_dochub_structure_v1
-- Date: 2025-12-29
-- Description: Stores per-project DocHub folder naming overrides (v1).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS dochub_structure_v1 JSONB;

