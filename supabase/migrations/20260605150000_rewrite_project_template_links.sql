-- Migration: rewrite_project_template_links
-- Date: 2026-06-05
-- Description: Creates project-scoped copies for linked legacy templates and rewrites project links to those copies.

DO $$
DECLARE
  link_record RECORD;
  scoped_template_id UUID;
BEGIN
  FOR link_record IN (
    WITH project_template_links AS (
      SELECT
        p.id AS project_id,
        p.owner_id AS user_id,
        'inquiry_letter_link' AS link_column,
        replace(p.inquiry_letter_link, 'template:', '')::UUID AS legacy_template_id
      FROM public.projects p
      WHERE p.owner_id IS NOT NULL
        AND p.inquiry_letter_link LIKE 'template:%'
        AND replace(p.inquiry_letter_link, 'template:', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

      UNION ALL

      SELECT
        p.id AS project_id,
        p.owner_id AS user_id,
        'material_inquiry_template_link' AS link_column,
        replace(p.material_inquiry_template_link, 'template:', '')::UUID AS legacy_template_id
      FROM public.projects p
      WHERE p.owner_id IS NOT NULL
        AND p.material_inquiry_template_link LIKE 'template:%'
        AND replace(p.material_inquiry_template_link, 'template:', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

      UNION ALL

      SELECT
        p.id AS project_id,
        p.owner_id AS user_id,
        'losers_email_template_link' AS link_column,
        replace(p.losers_email_template_link, 'template:', '')::UUID AS legacy_template_id
      FROM public.projects p
      WHERE p.owner_id IS NOT NULL
        AND p.losers_email_template_link LIKE 'template:%'
        AND replace(p.losers_email_template_link, 'template:', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
    SELECT
      ptl.project_id,
      ptl.user_id,
      ptl.link_column,
      legacy.id AS legacy_template_id,
      legacy.name,
      legacy.subject,
      legacy.content,
      legacy.is_default,
      legacy.source_template_id
    FROM project_template_links ptl
    JOIN public.templates legacy
      ON legacy.id = ptl.legacy_template_id
     AND legacy.user_id = ptl.user_id
     AND legacy.project_id IS NULL
  ) LOOP
    SELECT existing.id
      INTO scoped_template_id
    FROM public.templates existing
    WHERE existing.user_id = link_record.user_id
      AND existing.project_id = link_record.project_id
      AND existing.name = link_record.name
      AND existing.subject = link_record.subject
      AND existing.content = link_record.content
    ORDER BY existing.created_at
    LIMIT 1;

    IF scoped_template_id IS NULL THEN
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
      VALUES (
        link_record.user_id,
        link_record.project_id,
        link_record.name,
        link_record.subject,
        link_record.content,
        link_record.is_default,
        link_record.source_template_id,
        NOW(),
        NOW()
      )
      RETURNING id INTO scoped_template_id;
    END IF;

    IF link_record.link_column = 'inquiry_letter_link' THEN
      UPDATE public.projects
      SET inquiry_letter_link = 'template:' || scoped_template_id::TEXT
      WHERE id = link_record.project_id;
    ELSIF link_record.link_column = 'material_inquiry_template_link' THEN
      UPDATE public.projects
      SET material_inquiry_template_link = 'template:' || scoped_template_id::TEXT
      WHERE id = link_record.project_id;
    ELSIF link_record.link_column = 'losers_email_template_link' THEN
      UPDATE public.projects
      SET losers_email_template_link = 'template:' || scoped_template_id::TEXT
      WHERE id = link_record.project_id;
    END IF;

    scoped_template_id := NULL;
  END LOOP;
END $$;
