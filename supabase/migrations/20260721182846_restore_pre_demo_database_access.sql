-- The public demo is implemented with local frontend mock data. These preceding
-- demo-removal migrations changed production RLS unnecessarily. Restore the
-- pre-change project/category visibility while keeping bids tenant-scoped and
-- aligned with the demand_category_id column used by the application.

DROP POLICY IF EXISTS "Projects visible to owner or explicit shares"
  ON public.projects;
DROP POLICY IF EXISTS "Projects visible to owner, explicit shares, or public demo"
  ON public.projects;

CREATE POLICY "Projects visible to owner, explicit shares, or public demo"
ON public.projects
FOR SELECT
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  OR public.is_project_shared_with_user(id, (SELECT auth.uid()))
  OR (
    is_demo = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_hidden_projects uhp
      WHERE uhp.project_id = projects.id
        AND uhp.user_id = (SELECT auth.uid())
    )
  )
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
        OR (
          p.is_demo = true
          AND NOT EXISTS (
            SELECT 1
            FROM public.user_hidden_projects uhp
            WHERE uhp.project_id = p.id
              AND uhp.user_id = (SELECT auth.uid())
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Bids inherit category->project access"
  ON public.bids;
DROP POLICY IF EXISTS "Bids visible through project"
  ON public.bids;
DROP POLICY IF EXISTS "Bids insert for project editors"
  ON public.bids;
DROP POLICY IF EXISTS "Bids update for project editors"
  ON public.bids;
DROP POLICY IF EXISTS "Bids delete for project editors"
  ON public.bids;

CREATE POLICY "Bids visible through project"
ON public.bids
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.demand_categories dc
    JOIN public.projects p ON p.id = dc.project_id
    WHERE dc.id::text = bids.demand_category_id::text
      AND (
        p.owner_id = (SELECT auth.uid())
        OR (
          p.organization_id IS NOT NULL
          AND public.is_org_member(p.organization_id)
        )
        OR public.is_project_shared_with_user(p.id, (SELECT auth.uid()))
      )
  )
);

CREATE POLICY "Bids insert for project editors"
ON public.bids
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.demand_categories dc
    JOIN public.projects p ON p.id = dc.project_id
    WHERE dc.id::text = bids.demand_category_id::text
      AND (
        p.owner_id = (SELECT auth.uid())
        OR (
          p.organization_id IS NOT NULL
          AND public.is_org_member(p.organization_id)
        )
        OR public.has_project_share_permission(
          p.id,
          (SELECT auth.uid()),
          'edit'
        )
      )
  )
);

CREATE POLICY "Bids update for project editors"
ON public.bids
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.demand_categories dc
    JOIN public.projects p ON p.id = dc.project_id
    WHERE dc.id::text = bids.demand_category_id::text
      AND (
        p.owner_id = (SELECT auth.uid())
        OR (
          p.organization_id IS NOT NULL
          AND public.is_org_member(p.organization_id)
        )
        OR public.has_project_share_permission(
          p.id,
          (SELECT auth.uid()),
          'edit'
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.demand_categories dc
    JOIN public.projects p ON p.id = dc.project_id
    WHERE dc.id::text = bids.demand_category_id::text
      AND (
        p.owner_id = (SELECT auth.uid())
        OR (
          p.organization_id IS NOT NULL
          AND public.is_org_member(p.organization_id)
        )
        OR public.has_project_share_permission(
          p.id,
          (SELECT auth.uid()),
          'edit'
        )
      )
  )
);

CREATE POLICY "Bids delete for project editors"
ON public.bids
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.demand_categories dc
    JOIN public.projects p ON p.id = dc.project_id
    WHERE dc.id::text = bids.demand_category_id::text
      AND (
        p.owner_id = (SELECT auth.uid())
        OR (
          p.organization_id IS NOT NULL
          AND public.is_org_member(p.organization_id)
        )
        OR public.has_project_share_permission(
          p.id,
          (SELECT auth.uid()),
          'edit'
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
    OR (
      p.is_demo = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_projects uhp
        WHERE uhp.project_id = p.id
          AND uhp.user_id = auth.uid()
      )
    )
  GROUP BY p.id, owner_u.email;
END;
$$;

-- Keep the security hardening from the previous migration: metadata remains
-- authenticated-only even though the pre-change result set is restored.
REVOKE ALL ON FUNCTION public.get_projects_metadata() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_projects_metadata() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_projects_metadata() TO authenticated;
