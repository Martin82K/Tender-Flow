-- Migration: add_losers_email_template_to_projects
-- Date: 2026-01-03
-- Description: Adds template link for "email nevybraným účastníkům" to projects.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS losers_email_template_link TEXT;

