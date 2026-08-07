-- Demo projects are intentionally readable by authenticated users unless they
-- explicitly hide them. Keep bid mutations editor-only while aligning bid
-- visibility with the existing project and demand-category SELECT policies.

DROP POLICY IF EXISTS "Bids visible through project"
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
