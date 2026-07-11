-- Remove legacy policies that currently compose permissively. An unconditional
-- policy would bypass every project-scoped policy below.
ALTER TABLE public.demand_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users"
  ON public.demand_categories;
DROP POLICY IF EXISTS "Users can manage their project categories"
  ON public.demand_categories;
DROP POLICY IF EXISTS "Categories inherit project access"
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

CREATE POLICY "Demand categories insert for project editors"
ON public.demand_categories
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = demand_categories.project_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
      )
  )
);

CREATE POLICY "Demand categories update for project editors"
ON public.demand_categories
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = demand_categories.project_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = demand_categories.project_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
      )
  )
);

CREATE POLICY "Demand categories delete for project editors"
ON public.demand_categories
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = demand_categories.project_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
      )
  )
);

-- Data API callers need CRUD only. RLS does not protect TRUNCATE, REFERENCES,
-- or TRIGGER, so inherited broad grants must not remain on public clients.
REVOKE ALL ON TABLE public.demand_categories FROM anon;
REVOKE ALL ON TABLE public.demand_categories FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.demand_categories TO authenticated;

CREATE INDEX IF NOT EXISTS idx_demand_categories_project_id
  ON public.demand_categories(project_id);
