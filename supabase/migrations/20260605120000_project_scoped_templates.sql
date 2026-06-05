-- Migration: project_scoped_templates
-- Date: 2026-06-05
-- Description: Scopes email templates to individual projects while preserving legacy user templates.

ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255) REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_templates_user_project ON public.templates(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_templates_project_default ON public.templates(project_id, is_default);

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'templates'
  ) LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.templates';
  END LOOP;
END $$;

CREATE POLICY "Users can read own project scoped templates"
ON public.templates
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = templates.project_id
    )
  )
);

CREATE POLICY "Users can insert own editable project scoped templates"
ON public.templates
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = templates.project_id
        AND (
          p.owner_id = auth.uid()
          OR public.has_project_share_permission(p.id, auth.uid(), 'edit')
        )
    )
  )
);

CREATE POLICY "Users can update own editable project scoped templates"
ON public.templates
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = templates.project_id
        AND (
          p.owner_id = auth.uid()
          OR public.has_project_share_permission(p.id, auth.uid(), 'edit')
        )
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = templates.project_id
        AND (
          p.owner_id = auth.uid()
          OR public.has_project_share_permission(p.id, auth.uid(), 'edit')
        )
    )
  )
);

CREATE POLICY "Users can delete own editable project scoped templates"
ON public.templates
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = templates.project_id
        AND (
          p.owner_id = auth.uid()
          OR public.has_project_share_permission(p.id, auth.uid(), 'edit')
        )
    )
  )
);
