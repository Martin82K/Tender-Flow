-- Registration copies every catalog template, but the legacy user scope permits
-- at most one default. Use the same ordering as the template deduplication
-- migration; do not delete catalog rows or change existing users' templates.
CREATE OR REPLACE FUNCTION public.copy_default_templates_to_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  INSERT INTO public.templates (
    user_id, name, subject, content, is_default,
    source_template_id, created_at, updated_at
  )
  SELECT
    NEW.id,
    catalog.name,
    catalog.subject,
    catalog.content,
    COALESCE(catalog.is_default, false) AND catalog.default_rank = 1,
    catalog.id,
    NOW(),
    NOW()
  FROM (
    SELECT
      source.*,
      ROW_NUMBER() OVER (
        ORDER BY source.is_default DESC NULLS LAST,
          source.updated_at DESC NULLS LAST,
          source.created_at DESC NULLS LAST,
          source.id ASC
      ) AS default_rank
    FROM public.default_templates AS source
  ) AS catalog;

  RETURN NEW;
END;
$$;
