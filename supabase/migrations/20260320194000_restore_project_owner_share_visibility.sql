-- Hotfix: restore strict project visibility (owner + explicit share + demo only)
-- Reason: org-wide project visibility exposed projects that were not explicitly shared.

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

CREATE POLICY "Projects visible to owner, explicit shares, or public demo"
ON public.projects
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_project_shared_with_user(id, auth.uid())
  OR (
    is_demo = true
    AND id NOT IN (
      SELECT uhp.project_id
      FROM public.user_hidden_projects uhp
      WHERE uhp.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Projects insert for owner in own tenant"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    organization_id IS NULL
    OR public.is_org_member(organization_id)
  )
);

CREATE POLICY "Projects update for owner or shared editor"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.has_project_share_permission(id, auth.uid(), 'edit')
)
WITH CHECK (
  owner_id = auth.uid()
  OR public.has_project_share_permission(id, auth.uid(), 'edit')
);

CREATE POLICY "Projects delete for owner only"
ON public.projects
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
);

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
    p.id::VARCHAR(255) AS project_id,
    owner_u.email::VARCHAR(255) AS owner_email,
    array_remove(array_agg(DISTINCT shared_u.email::TEXT), NULL) AS shared_with_emails
  FROM public.projects p
  LEFT JOIN auth.users owner_u ON p.owner_id = owner_u.id
  LEFT JOIN public.project_shares ps ON p.id = ps.project_id
  LEFT JOIN auth.users shared_u ON ps.user_id = shared_u.id
  WHERE
    p.owner_id = auth.uid()
    OR public.is_project_shared_with_user(p.id, auth.uid())
    OR (
      p.is_demo = true
      AND p.id NOT IN (
        SELECT uhp.project_id
        FROM public.user_hidden_projects uhp
        WHERE uhp.user_id = auth.uid()
      )
    )
  GROUP BY p.id, owner_u.email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects_metadata TO authenticated;

CREATE OR REPLACE FUNCTION public.get_project_shares(project_id_input TEXT)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  permission VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_id_input
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.project_shares ps
          WHERE ps.project_id = project_id_input
            AND ps.user_id = auth.uid()
        )
      )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ps.user_id,
    au.email::VARCHAR(255),
    ps.permission
  FROM public.project_shares ps
  JOIN auth.users au ON au.id = ps.user_id
  WHERE ps.project_id = project_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_project_shares_v2(project_id_input TEXT)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  permission VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_id_input
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.project_shares ps
          WHERE ps.project_id = project_id_input
            AND ps.user_id = auth.uid()
        )
      )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ps.user_id,
    au.email::VARCHAR(255),
    ps.permission
  FROM public.project_shares ps
  JOIN auth.users au ON au.id = ps.user_id
  WHERE ps.project_id = project_id_input;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_shares(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_shares_v2(TEXT) TO authenticated;
