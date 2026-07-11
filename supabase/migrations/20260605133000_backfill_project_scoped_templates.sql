-- Migration: backfill_project_scoped_templates
-- Date: 2026-06-05
-- Description: Copies templates for project owners and editors and falls back to master defaults.

WITH accessible_project_users AS (
  SELECT p.owner_id AS user_id, p.id AS project_id
  FROM public.projects p
  WHERE p.owner_id IS NOT NULL

  UNION

  SELECT ps.user_id, ps.project_id
  FROM public.project_shares ps
  WHERE ps.user_id IS NOT NULL
    AND ps.permission = 'edit'
),
legacy_template_copies AS (
  INSERT INTO public.templates (
    user_id,
    project_id,
    name,
    subject,
    content,
    is_default,
    source_template_id,
    created_at,
    updated_at
  )
  SELECT
    apu.user_id,
    apu.project_id,
    legacy.name,
    legacy.subject,
    legacy.content,
    legacy.is_default,
    legacy.source_template_id,
    NOW(),
    NOW()
  FROM accessible_project_users apu
  JOIN public.templates legacy
    ON legacy.user_id = apu.user_id
   AND legacy.project_id IS NULL
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.templates existing
    WHERE existing.user_id = apu.user_id
      AND existing.project_id = apu.project_id
  )
  RETURNING user_id, project_id
)
INSERT INTO public.templates (
  user_id,
  project_id,
  name,
  subject,
  content,
  is_default,
  source_template_id,
  created_at,
  updated_at
)
SELECT
  apu.user_id,
  apu.project_id,
  defaults.name,
  defaults.subject,
  defaults.content,
  defaults.is_default,
  defaults.id,
  NOW(),
  NOW()
FROM accessible_project_users apu
CROSS JOIN public.default_templates defaults
WHERE NOT EXISTS (
  SELECT 1
  FROM public.templates existing
  WHERE existing.user_id = apu.user_id
    AND existing.project_id = apu.project_id
)
AND NOT EXISTS (
  SELECT 1
  FROM legacy_template_copies copied
  WHERE copied.user_id = apu.user_id
    AND copied.project_id = apu.project_id
);
