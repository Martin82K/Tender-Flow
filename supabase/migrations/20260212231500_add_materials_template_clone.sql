-- Migration: add_materials_template_clone
-- Date: 2026-02-12
-- Description: Clones "MK poptávka standard" into a new default template "poptávka materiály"
--              and seeds it to existing users that do not have it yet.

DO $$
DECLARE
  source_template public.default_templates%ROWTYPE;
  target_template_id UUID;
BEGIN
  SELECT *
  INTO source_template
  FROM public.default_templates
  WHERE name = 'MK poptávka standard'
  ORDER BY created_at ASC
  LIMIT 1;

  IF source_template.id IS NULL THEN
    RAISE NOTICE 'Source template "MK poptávka standard" not found, skipping migration logic.';
    RETURN;
  END IF;

  SELECT id
  INTO target_template_id
  FROM public.default_templates
  WHERE lower(name) = lower('poptávka materiály')
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_template_id IS NULL THEN
    INSERT INTO public.default_templates (
      name,
      subject,
      content,
      is_default,
      sort_order,
      created_at,
      updated_at
    ) VALUES (
      'poptávka materiály',
      source_template.subject,
      source_template.content,
      false,
      COALESCE(source_template.sort_order, 0) + 1,
      NOW(),
      NOW()
    )
    RETURNING id INTO target_template_id;
  END IF;

  INSERT INTO public.templates (
    user_id,
    name,
    subject,
    content,
    is_default,
    source_template_id,
    created_at,
    updated_at
  )
  SELECT
    u.id,
    'poptávka materiály',
    source_template.subject,
    source_template.content,
    false,
    target_template_id,
    NOW(),
    NOW()
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.templates t
    WHERE t.user_id = u.id
      AND (
        t.source_template_id = target_template_id
        OR lower(t.name) = lower('poptávka materiály')
      )
  );
END $$;
