-- Migration: personal_project_template_selections
-- Date: 2026-08-13
-- Description: Keeps template content and active selections isolated per user and project.

-- Resolve existing duplicate defaults deterministically before enforcing the invariant.
-- Two known duplicate scopes belong to archived projects. Temporarily suspend
-- only their write guard inside this migration transaction, change only the
-- default flag, and restore the guard before adding any new schema objects.
ALTER TABLE public.templates DISABLE TRIGGER trg_archived_guard_templates;

WITH ranked_defaults AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, project_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id ASC
    ) AS default_rank
  FROM public.templates
  WHERE is_default
)
UPDATE public.templates AS template
SET is_default = false,
    updated_at = NOW()
FROM ranked_defaults
WHERE template.id = ranked_defaults.id
  AND ranked_defaults.default_rank > 1;

ALTER TABLE public.templates ENABLE TRIGGER trg_archived_guard_templates;

CREATE UNIQUE INDEX IF NOT EXISTS uq_templates_one_project_default
  ON public.templates(user_id, project_id)
  WHERE is_default AND project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_templates_one_legacy_default
  ON public.templates(user_id)
  WHERE is_default AND project_id IS NULL;

-- Required by the composite foreign key below. The primary key already makes id
-- unique; the wider constraint additionally lets PostgreSQL verify scope ownership.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'templates_id_user_project_unique'
      AND conrelid = 'public.templates'::regclass
  ) THEN
    ALTER TABLE public.templates
      ADD CONSTRAINT templates_id_user_project_unique
      UNIQUE (id, user_id, project_id);
  END IF;
END;
$$;

CREATE TABLE public.project_template_selections (
  project_id VARCHAR(36) NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_kind TEXT NOT NULL CHECK (template_kind IN ('inquiry', 'materialInquiry', 'losers')),
  template_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id, template_kind),
  CONSTRAINT project_template_selections_scoped_template_fk
    FOREIGN KEY (template_id, user_id, project_id)
    REFERENCES public.templates(id, user_id, project_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_project_template_selections_template
  ON public.project_template_selections(template_id);

ALTER TABLE public.project_template_selections ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_archived_guard_project_template_selections
BEFORE INSERT OR UPDATE OR DELETE ON public.project_template_selections
FOR EACH ROW
EXECUTE FUNCTION public.guard_archived_project_write('direct', 'project_id');

CREATE POLICY "Users can read own project template selections"
ON public.project_template_selections
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND (SELECT public.user_has_feature('dynamic_templates'))
  AND EXISTS (
    SELECT 1
    FROM public.projects project
    WHERE project.id = project_template_selections.project_id
      AND project.status IS DISTINCT FROM 'archived'
      AND (
        project.owner_id = (SELECT auth.uid())
        OR public.is_project_shared_with_user(project.id, (SELECT auth.uid()))
      )
  )
);

CREATE POLICY "Users can insert own project template selections"
ON public.project_template_selections
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (SELECT public.user_has_feature('dynamic_templates'))
  AND EXISTS (
    SELECT 1
    FROM public.projects project
    WHERE project.id = project_template_selections.project_id
      AND project.status IS DISTINCT FROM 'archived'
      AND (
        project.owner_id = (SELECT auth.uid())
        OR public.has_project_share_permission(project.id, (SELECT auth.uid()), 'edit')
      )
  )
);

CREATE POLICY "Users can update own project template selections"
ON public.project_template_selections
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND (SELECT public.user_has_feature('dynamic_templates'))
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (SELECT public.user_has_feature('dynamic_templates'))
  AND EXISTS (
    SELECT 1
    FROM public.projects project
    WHERE project.id = project_template_selections.project_id
      AND (
        project.owner_id = (SELECT auth.uid())
        OR public.has_project_share_permission(project.id, (SELECT auth.uid()), 'edit')
      )
  )
);

CREATE POLICY "Users can delete own project template selections"
ON public.project_template_selections
FOR DELETE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND (SELECT public.user_has_feature('dynamic_templates'))
);

REVOKE ALL ON public.project_template_selections FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_template_selections TO authenticated;
GRANT ALL ON public.project_template_selections TO service_role;

-- Preserve the owner's current choice. Collaborators intentionally receive no
-- shared UUID; their personal choice starts from their own default/template.
WITH legacy_links AS (
  SELECT id AS project_id, owner_id AS user_id, 'inquiry'::TEXT AS template_kind,
         REPLACE(inquiry_letter_link, 'template:', '')::UUID AS template_id
  FROM public.projects
  WHERE owner_id IS NOT NULL
    AND status IS DISTINCT FROM 'archived'
    AND inquiry_letter_link ~* '^template:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  UNION ALL
  SELECT id, owner_id, 'materialInquiry',
         REPLACE(material_inquiry_template_link, 'template:', '')::UUID
  FROM public.projects
  WHERE owner_id IS NOT NULL
    AND status IS DISTINCT FROM 'archived'
    AND material_inquiry_template_link ~* '^template:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  UNION ALL
  SELECT id, owner_id, 'losers',
         REPLACE(losers_email_template_link, 'template:', '')::UUID
  FROM public.projects
  WHERE owner_id IS NOT NULL
    AND status IS DISTINCT FROM 'archived'
    AND losers_email_template_link ~* '^template:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
INSERT INTO public.project_template_selections (
  project_id,
  user_id,
  template_kind,
  template_id
)
SELECT legacy.project_id, legacy.user_id, legacy.template_kind, legacy.template_id
FROM legacy_links AS legacy
JOIN public.templates AS template
  ON template.id = legacy.template_id
 AND template.user_id = legacy.user_id
 AND template.project_id = legacy.project_id
ON CONFLICT (project_id, user_id, template_kind) DO NOTHING;

CREATE OR REPLACE FUNCTION public.save_scoped_template(
  p_template_id UUID,
  p_project_id VARCHAR(36),
  p_name TEXT,
  p_subject TEXT,
  p_content TEXT,
  p_is_default BOOLEAN
)
RETURNS public.templates
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := (SELECT auth.uid());
  saved_template public.templates;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (SELECT public.user_has_feature('dynamic_templates')) THEN
    RAISE EXCEPTION 'Dynamic templates feature required' USING ERRCODE = '42501';
  END IF;

  IF p_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.projects project
    WHERE project.id = p_project_id
      AND project.status IS DISTINCT FROM 'archived'
      AND (
        project.owner_id = current_user_id
        OR public.has_project_share_permission(project.id, current_user_id, 'edit')
      )
  ) THEN
    RAISE EXCEPTION 'Project template edit permission required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      current_user_id::TEXT || ':' || COALESCE(p_project_id, '<legacy>'),
      0
    )
  );

  IF p_template_id IS NOT NULL THEN
    SELECT *
    INTO saved_template
    FROM public.templates
    WHERE id = p_template_id
      AND user_id = current_user_id
      AND project_id IS NOT DISTINCT FROM p_project_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Template does not belong to the requested user and project scope'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_is_default THEN
    UPDATE public.templates
    SET is_default = false,
        updated_at = NOW()
    WHERE user_id = current_user_id
      AND project_id IS NOT DISTINCT FROM p_project_id
      AND is_default
      AND (p_template_id IS NULL OR id <> p_template_id);
  END IF;

  IF p_template_id IS NULL THEN
    INSERT INTO public.templates (
      user_id,
      project_id,
      name,
      subject,
      content,
      is_default,
      updated_at
    )
    VALUES (
      current_user_id,
      p_project_id,
      p_name,
      p_subject,
      p_content,
      p_is_default,
      NOW()
    )
    RETURNING * INTO saved_template;
  ELSE
    UPDATE public.templates
    SET name = p_name,
        subject = p_subject,
        content = p_content,
        is_default = p_is_default,
        updated_at = NOW()
    WHERE id = p_template_id
      AND user_id = current_user_id
      AND project_id IS NOT DISTINCT FROM p_project_id
    RETURNING * INTO saved_template;
  END IF;

  RETURN saved_template;
END;
$$;

REVOKE ALL ON FUNCTION public.save_scoped_template(UUID, VARCHAR, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_scoped_template(UUID, VARCHAR, TEXT, TEXT, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_scoped_template(UUID, VARCHAR, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_scoped_template(UUID, VARCHAR, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
