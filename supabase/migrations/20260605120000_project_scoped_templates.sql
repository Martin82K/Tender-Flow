-- Migration: project_scoped_templates
-- Date: 2026-06-05
-- Description: Scopes email templates to individual projects while preserving legacy user templates.

ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(36) REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_templates_user_project ON public.templates(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_templates_project_default ON public.templates(project_id, is_default);

-- Replace only policies owned by this feature. Never drop every policy on the
-- table: later migrations may add independent authorization requirements.
DROP POLICY IF EXISTS "Users can read own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can read own project scoped templates" ON public.templates;
DROP POLICY IF EXISTS "Users can insert own editable project scoped templates" ON public.templates;
DROP POLICY IF EXISTS "Users can update own editable project scoped templates" ON public.templates;
DROP POLICY IF EXISTS "Users can delete own editable project scoped templates" ON public.templates;

CREATE POLICY "Users can read own project scoped templates"
ON public.templates
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND (SELECT public.user_has_feature('dynamic_templates'))
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = templates.project_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.is_project_shared_with_user(p.id, (SELECT auth.uid()))
        )
    )
  )
);

CREATE POLICY "Users can insert own editable project scoped templates"
ON public.templates
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (SELECT public.user_has_feature('dynamic_templates'))
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = templates.project_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
        )
    )
  )
);

CREATE POLICY "Users can update own editable project scoped templates"
ON public.templates
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND (SELECT public.user_has_feature('dynamic_templates'))
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = templates.project_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
        )
    )
  )
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (SELECT public.user_has_feature('dynamic_templates'))
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = templates.project_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
        )
    )
  )
);

CREATE POLICY "Users can delete own editable project scoped templates"
ON public.templates
FOR DELETE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND (SELECT public.user_has_feature('dynamic_templates'))
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = templates.project_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
        )
    )
  )
);
