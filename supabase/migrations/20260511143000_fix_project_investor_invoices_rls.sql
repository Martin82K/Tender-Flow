-- Fix investor invoice RLS for legacy ownerless projects.
-- The parent projects table still allows authenticated users to edit ownerless
-- projects, so investor invoice management must follow the same edit surface.

ALTER TABLE public.project_investor_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage investor invoices via project"
  ON public.project_investor_invoices;
CREATE POLICY "Manage investor invoices via project"
  ON public.project_investor_invoices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_investor_invoices.project_id
        AND (
          p.owner_id = auth.uid()
          OR p.owner_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
              AND ps.permission = 'edit'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_investor_invoices.project_id
        AND (
          p.owner_id = auth.uid()
          OR p.owner_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
              AND ps.permission = 'edit'
          )
        )
    )
  );
