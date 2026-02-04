-- Migration: Free tier gating + project limit
-- Date: 2026-02-04
-- Description: Enforce free-tier project limit and feature-gated RLS policies.

-- -----------------------------------------------------------------------------
-- 1) Project creation limit (Free tier: 1 active project)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_create_project()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier TEXT;
  active_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  user_tier := public.get_user_subscription_tier(auth.uid());

  IF user_tier IS NULL OR user_tier = 'free' THEN
    SELECT COUNT(*)
    INTO active_count
    FROM public.projects
    WHERE owner_id = auth.uid()
      AND COALESCE(status, 'realization') <> 'archived';

    RETURN active_count < 1;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_create_project() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_project() TO service_role;

DROP POLICY IF EXISTS "Strict Project Insert" ON public.projects;
CREATE POLICY "Strict Project Insert" ON public.projects
  FOR INSERT
  WITH CHECK (
    (auth.uid() = owner_id OR owner_id IS NULL)
    AND public.can_create_project()
  );

-- -----------------------------------------------------------------------------
-- 2) Contracts module gating
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
CREATE POLICY "contracts_select" ON public.contracts FOR SELECT USING (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = contracts.project_id AND (
      p.owner_id = auth.uid() OR p.owner_id IS NULL OR
      EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
CREATE POLICY "contracts_insert" ON public.contracts FOR INSERT WITH CHECK (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = contracts.project_id AND (
      p.owner_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    )
  )
);

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE USING (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = contracts.project_id AND (
      p.owner_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    )
  )
);

DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;
CREATE POLICY "contracts_delete" ON public.contracts FOR DELETE USING (
  public.user_has_feature('module_contracts')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = contracts.project_id AND p.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "amendments_select" ON public.contract_amendments;
CREATE POLICY "amendments_select" ON public.contract_amendments FOR SELECT USING (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.contracts c JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = contract_amendments.contract_id AND (
      p.owner_id = auth.uid() OR p.owner_id IS NULL OR
      EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "amendments_insert" ON public.contract_amendments;
CREATE POLICY "amendments_insert" ON public.contract_amendments FOR INSERT WITH CHECK (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.contracts c JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = contract_amendments.contract_id AND (
      p.owner_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    )
  )
);

DROP POLICY IF EXISTS "amendments_update" ON public.contract_amendments;
CREATE POLICY "amendments_update" ON public.contract_amendments FOR UPDATE USING (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.contracts c JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = contract_amendments.contract_id AND (
      p.owner_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    )
  )
);

DROP POLICY IF EXISTS "amendments_delete" ON public.contract_amendments;
CREATE POLICY "amendments_delete" ON public.contract_amendments FOR DELETE USING (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.contracts c JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = contract_amendments.contract_id AND p.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "drawdowns_select" ON public.contract_drawdowns;
CREATE POLICY "drawdowns_select" ON public.contract_drawdowns FOR SELECT USING (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.contracts c JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = contract_drawdowns.contract_id AND (
      p.owner_id = auth.uid() OR p.owner_id IS NULL OR
      EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "drawdowns_insert" ON public.contract_drawdowns;
CREATE POLICY "drawdowns_insert" ON public.contract_drawdowns FOR INSERT WITH CHECK (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.contracts c JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = contract_drawdowns.contract_id AND (
      p.owner_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    )
  )
);

DROP POLICY IF EXISTS "drawdowns_update" ON public.contract_drawdowns;
CREATE POLICY "drawdowns_update" ON public.contract_drawdowns FOR UPDATE USING (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.contracts c JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = contract_drawdowns.contract_id AND (
      p.owner_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = auth.uid() AND ps.permission = 'edit')
    )
  )
);

DROP POLICY IF EXISTS "drawdowns_delete" ON public.contract_drawdowns;
CREATE POLICY "drawdowns_delete" ON public.contract_drawdowns FOR DELETE USING (
  public.user_has_feature('module_contracts')
  AND EXISTS (
    SELECT 1 FROM public.contracts c JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = contract_drawdowns.contract_id AND p.owner_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- 3) DocHub gating (autocreate runs)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own dochub autocreate runs" ON public.dochub_autocreate_runs;
DROP POLICY IF EXISTS "Users can insert own dochub autocreate runs" ON public.dochub_autocreate_runs;
DROP POLICY IF EXISTS "Users can update own dochub autocreate runs" ON public.dochub_autocreate_runs;
DROP POLICY IF EXISTS "Users can delete own dochub autocreate runs" ON public.dochub_autocreate_runs;

CREATE POLICY "Users can read own dochub autocreate runs"
  ON public.dochub_autocreate_runs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND public.user_has_feature('doc_hub'));

CREATE POLICY "Users can insert own dochub autocreate runs"
  ON public.dochub_autocreate_runs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.user_has_feature('doc_hub'));

CREATE POLICY "Users can update own dochub autocreate runs"
  ON public.dochub_autocreate_runs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.user_has_feature('doc_hub'))
  WITH CHECK (user_id = auth.uid() AND public.user_has_feature('doc_hub'));

CREATE POLICY "Users can delete own dochub autocreate runs"
  ON public.dochub_autocreate_runs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND public.user_has_feature('doc_hub'));

-- -----------------------------------------------------------------------------
-- 4) URL shortener gating
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create short URLs" ON public.short_urls;
DROP POLICY IF EXISTS "Users can delete their own short URLs" ON public.short_urls;

CREATE POLICY "Authenticated users can create short URLs" ON public.short_urls
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.user_has_feature('url_shortener'));

CREATE POLICY "Users can delete their own short URLs" ON public.short_urls
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by AND public.user_has_feature('url_shortener'));

-- -----------------------------------------------------------------------------
-- 5) Templates gating
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.templates;

CREATE POLICY "Users can read own templates"
  ON public.templates
  FOR SELECT
  USING (user_id = auth.uid() AND public.user_has_feature('dynamic_templates'));

CREATE POLICY "Users can insert own templates"
  ON public.templates
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.user_has_feature('dynamic_templates'));

CREATE POLICY "Users can update own templates"
  ON public.templates
  FOR UPDATE
  USING (user_id = auth.uid() AND public.user_has_feature('dynamic_templates'));

CREATE POLICY "Users can delete own templates"
  ON public.templates
  FOR DELETE
  USING (user_id = auth.uid() AND public.user_has_feature('dynamic_templates'));

-- -----------------------------------------------------------------------------
-- 6) Excel Indexer gating
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'excel_indexer_entries'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their organization''s entries" ON public.excel_indexer_entries';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert entries for their organization" ON public.excel_indexer_entries';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their organization''s entries" ON public.excel_indexer_entries';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete their organization''s entries" ON public.excel_indexer_entries';

    EXECUTE '
      CREATE POLICY "Users can view their organization''s entries"
        ON public.excel_indexer_entries
        FOR SELECT
        USING (
          public.user_has_feature(''excel_indexer'')
          AND organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
          )
        )
    ';

    EXECUTE '
      CREATE POLICY "Users can insert entries for their organization"
        ON public.excel_indexer_entries
        FOR INSERT
        WITH CHECK (
          public.user_has_feature(''excel_indexer'')
          AND organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
          )
        )
    ';

    EXECUTE '
      CREATE POLICY "Users can update their organization''s entries"
        ON public.excel_indexer_entries
        FOR UPDATE
        USING (
          public.user_has_feature(''excel_indexer'')
          AND organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
          )
        )
    ';

    EXECUTE '
      CREATE POLICY "Users can delete their organization''s entries"
        ON public.excel_indexer_entries
        FOR DELETE
        USING (
          public.user_has_feature(''excel_indexer'')
          AND organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
          )
        )
    ';
  END IF;
END $$;
