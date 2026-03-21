-- Migration: harden_ownerless_sensitive_project_data_rls
-- Date: 2026-03-20
-- Description: Removes legacy NULL-owner fallback from sensitive project contract and financial data.

ALTER TABLE public.project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_investor_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_drawdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_markdown_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select contracts via project" ON public.project_contracts;
CREATE POLICY "Select contracts via project" ON public.project_contracts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_contracts.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Manage contracts via project" ON public.project_contracts;
CREATE POLICY "Manage contracts via project" ON public.project_contracts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_contracts.project_id
        AND (
          p.owner_id = auth.uid()
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
      WHERE p.id = project_contracts.project_id
        AND (
          p.owner_id = auth.uid()
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

DROP POLICY IF EXISTS "Select financials via project" ON public.project_investor_financials;
CREATE POLICY "Select financials via project" ON public.project_investor_financials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_investor_financials.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Manage financials via project" ON public.project_investor_financials;
CREATE POLICY "Manage financials via project" ON public.project_investor_financials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_investor_financials.project_id
        AND (
          p.owner_id = auth.uid()
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
      WHERE p.id = project_investor_financials.project_id
        AND (
          p.owner_id = auth.uid()
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

DROP POLICY IF EXISTS "Select amendments via project" ON public.project_amendments;
CREATE POLICY "Select amendments via project" ON public.project_amendments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_amendments.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Manage amendments via project" ON public.project_amendments;
CREATE POLICY "Manage amendments via project" ON public.project_amendments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_amendments.project_id
        AND (
          p.owner_id = auth.uid()
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
      WHERE p.id = project_amendments.project_id
        AND (
          p.owner_id = auth.uid()
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

DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT
  TO authenticated
  USING (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = contracts.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
CREATE POLICY "contracts_insert" ON public.contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = contracts.project_id
        AND (
          p.owner_id = auth.uid()
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

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE
  TO authenticated
  USING (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = contracts.project_id
        AND (
          p.owner_id = auth.uid()
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
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = contracts.project_id
        AND (
          p.owner_id = auth.uid()
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

DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;
CREATE POLICY "contracts_delete" ON public.contracts
  FOR DELETE
  TO authenticated
  USING (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = contracts.project_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "amendments_select" ON public.contract_amendments;
CREATE POLICY "amendments_select" ON public.contract_amendments
  FOR SELECT
  TO authenticated
  USING (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = contract_amendments.contract_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "amendments_insert" ON public.contract_amendments;
CREATE POLICY "amendments_insert" ON public.contract_amendments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = contract_amendments.contract_id
        AND (
          p.owner_id = auth.uid()
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

DROP POLICY IF EXISTS "amendments_update" ON public.contract_amendments;
CREATE POLICY "amendments_update" ON public.contract_amendments
  FOR UPDATE
  TO authenticated
  USING (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = contract_amendments.contract_id
        AND (
          p.owner_id = auth.uid()
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
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = contract_amendments.contract_id
        AND (
          p.owner_id = auth.uid()
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

DROP POLICY IF EXISTS "amendments_delete" ON public.contract_amendments;
CREATE POLICY "amendments_delete" ON public.contract_amendments
  FOR DELETE
  TO authenticated
  USING (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = contract_amendments.contract_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "drawdowns_select" ON public.contract_drawdowns;
CREATE POLICY "drawdowns_select" ON public.contract_drawdowns
  FOR SELECT
  TO authenticated
  USING (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = contract_drawdowns.contract_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "drawdowns_insert" ON public.contract_drawdowns;
CREATE POLICY "drawdowns_insert" ON public.contract_drawdowns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = contract_drawdowns.contract_id
        AND (
          p.owner_id = auth.uid()
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

DROP POLICY IF EXISTS "drawdowns_update" ON public.contract_drawdowns;
CREATE POLICY "drawdowns_update" ON public.contract_drawdowns
  FOR UPDATE
  TO authenticated
  USING (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = contract_drawdowns.contract_id
        AND (
          p.owner_id = auth.uid()
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
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = contract_drawdowns.contract_id
        AND (
          p.owner_id = auth.uid()
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

DROP POLICY IF EXISTS "drawdowns_delete" ON public.contract_drawdowns;
CREATE POLICY "drawdowns_delete" ON public.contract_drawdowns
  FOR DELETE
  TO authenticated
  USING (
    public.user_has_feature('module_contracts')
    AND EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = contract_drawdowns.contract_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_md_versions_select" ON public.contract_markdown_versions;
CREATE POLICY "contract_md_versions_select"
  ON public.contract_markdown_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = contract_markdown_versions.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
          )
        )
    )
  );
