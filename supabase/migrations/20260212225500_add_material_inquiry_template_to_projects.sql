-- Migration: add_material_inquiry_template_to_projects
-- Date: 2026-02-12
-- Description: Adds template link for "materiálová poptávka" to projects.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS material_inquiry_template_link TEXT;
