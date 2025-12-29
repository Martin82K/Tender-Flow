-- Migration: fix_projects_rls_recursion
-- Date: 2025-12-29
-- Description: Prevents infinite recursion between projects and project_shares RLS policies by using SECURITY DEFINER helper functions.

-- Helper: check if a project is shared with a user (any permission)
CREATE OR REPLACE FUNCTION public.is_project_shared_with_user(p_id TEXT, u_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_shares ps
    WHERE ps.project_id = p_id
      AND ps.user_id = u_id
  );
$$;

-- Helper: check if a project is shared with a user with a specific permission (e.g. 'edit')
CREATE OR REPLACE FUNCTION public.has_project_share_permission(p_id TEXT, u_id UUID, required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_shares ps
    WHERE ps.project_id = p_id
      AND ps.user_id = u_id
      AND ps.permission = required_permission
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_project_shared_with_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_project_share_permission TO authenticated;

-- Recreate projects policies to avoid direct queries to project_shares (prevents recursion)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'projects'
  ) LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.projects';
  END LOOP;
END $$;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Strict Project Visibility" ON public.projects
  FOR SELECT
  USING (
    owner_id IS NULL
    OR owner_id = auth.uid()
    OR public.is_project_shared_with_user(id, auth.uid())
  );

CREATE POLICY "Strict Project Insert" ON public.projects
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    OR owner_id IS NULL
  );

CREATE POLICY "Strict Project Update" ON public.projects
  FOR UPDATE
  USING (
    owner_id IS NULL
    OR owner_id = auth.uid()
    OR public.has_project_share_permission(id, auth.uid(), 'edit')
  );

CREATE POLICY "Strict Project Delete" ON public.projects
  FOR DELETE
  USING (
    owner_id IS NULL
    OR owner_id = auth.uid()
  );

