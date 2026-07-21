-- Public demo access is disabled. Requested demo access must use an explicitly
-- provisioned authenticated account with ordinary owner/share authorization.

DROP POLICY IF EXISTS "Projects visible to owner, explicit shares, or public demo"
  ON public.projects;
DROP POLICY IF EXISTS "Projects visible to owner or explicit shares"
  ON public.projects;

CREATE POLICY "Projects visible to owner or explicit shares"
ON public.projects
FOR SELECT
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  OR public.is_project_shared_with_user(id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Demand categories visible through project"
  ON public.demand_categories;

CREATE POLICY "Demand categories visible through project"
ON public.demand_categories
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = demand_categories.project_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.is_project_shared_with_user(p.id, (SELECT auth.uid()))
      )
  )
);

DROP POLICY IF EXISTS "Bids inherit category->project access"
  ON public.bids;

CREATE POLICY "Bids inherit category->project access"
ON public.bids
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.demand_categories dc
    JOIN public.projects p ON p.id = dc.project_id
    WHERE dc.id::text = bids.category_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR (
          p.organization_id IS NOT NULL
          AND public.is_org_member(p.organization_id)
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.demand_categories dc
    JOIN public.projects p ON p.id = dc.project_id
    WHERE dc.id::text = bids.category_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR (
          p.organization_id IS NOT NULL
          AND public.is_org_member(p.organization_id)
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.get_projects_metadata()
RETURNS TABLE (
  project_id VARCHAR(255),
  owner_email VARCHAR(255),
  shared_with_emails TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

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
  GROUP BY p.id, owner_u.email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_projects_metadata() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_projects_metadata() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_projects_metadata() TO authenticated;
