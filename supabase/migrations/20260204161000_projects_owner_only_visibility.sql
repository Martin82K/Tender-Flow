-- Migration: projects_owner_only_visibility
-- Date: 2026-02-04
-- Description: Restrict projects visibility to owner/shared/demo; tenant-wide access only via overview RPC.

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

CREATE POLICY "Projects visible to owner, shared users, or public demo"
ON public.projects FOR SELECT
TO authenticated
USING (
  owner_id IS NULL
  OR owner_id = auth.uid()
  OR public.is_project_shared_with_user(id, auth.uid())
  OR (
    is_demo = true
    AND id NOT IN (
      SELECT project_id
      FROM public.user_hidden_projects
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Projects insert for owner"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  OR owner_id IS NULL
);

CREATE POLICY "Projects update for owner or shared editor"
ON public.projects FOR UPDATE
TO authenticated
USING (
  owner_id IS NULL
  OR owner_id = auth.uid()
  OR public.has_project_share_permission(id, auth.uid(), 'edit')
);

CREATE POLICY "Projects delete for owner"
ON public.projects FOR DELETE
TO authenticated
USING (
  owner_id IS NULL
  OR owner_id = auth.uid()
);

-- Update metadata RPC to align with owner/shared visibility (no org-wide exposure here)
CREATE OR REPLACE FUNCTION public.get_projects_metadata()
RETURNS TABLE (
  project_id VARCHAR(255),
  owner_email VARCHAR(255),
  shared_with_emails TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id::VARCHAR(255),
    owner_u.email::VARCHAR(255) as owner_email,
    array_remove(array_agg(DISTINCT shared_u.email::TEXT), NULL) as shared_with_emails
  FROM public.projects p
  LEFT JOIN auth.users owner_u ON p.owner_id = owner_u.id
  LEFT JOIN public.project_shares ps ON p.id = ps.project_id
  LEFT JOIN auth.users shared_u ON ps.user_id = shared_u.id
  WHERE 
    (
      p.owner_id IS NULL
      OR p.owner_id = auth.uid()
      OR public.is_project_shared_with_user(p.id, auth.uid())
      OR (
        p.is_demo = true
        AND p.id NOT IN (
          SELECT project_id
          FROM public.user_hidden_projects
          WHERE user_id = auth.uid()
        )
      )
    )
  GROUP BY p.id, owner_u.email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects_metadata TO authenticated;
