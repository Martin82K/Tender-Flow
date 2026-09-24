-- Preserve bid SELECT decisions while evaluating category/project access once
-- per statement instead of once per bid. No grants, data, write policies,
-- subscription boundaries or SECURITY DEFINER functions are changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$
DECLARE
  category_column text;
BEGIN
  SELECT column_name INTO category_column FROM information_schema.columns
  WHERE table_schema='public' AND table_name='bids'
    AND column_name IN ('demand_category_id','category_id')
  ORDER BY CASE column_name WHEN 'demand_category_id' THEN 0 ELSE 1 END LIMIT 1;
  IF category_column IS NULL THEN
    RAISE EXCEPTION 'Bid category column is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bids'
      AND policyname='Bids visible through project' AND cmd='SELECT' AND permissive='PERMISSIVE'
      AND roles=ARRAY['authenticated']::name[])
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bids'
      AND policyname='team_module_bids_select' AND cmd='SELECT' AND permissive='RESTRICTIVE'
      AND roles=ARRAY['authenticated']::name[]) THEN
    RAISE EXCEPTION 'Unexpected bid SELECT policy configuration';
  END IF;

  EXECUTE format($policy$
    ALTER POLICY "Bids visible through project" ON public.bids
    USING (bids.%1$I::text = ANY (ARRAY(
      SELECT dc.id::text FROM public.demand_categories dc
      JOIN public.projects p ON p.id = dc.project_id
      WHERE p.owner_id = (SELECT auth.uid())
        OR (p.organization_id IS NOT NULL AND public.is_org_member(p.organization_id))
        OR public.is_project_shared_with_user(p.id, (SELECT auth.uid()))
        OR (p.is_demo = true AND NOT EXISTS (
          SELECT 1 FROM public.user_hidden_projects uhp
          WHERE uhp.project_id = p.id AND uhp.user_id = (SELECT auth.uid())
        ))
    )))
  $policy$, category_column);

  EXECUTE format($policy$
    ALTER POLICY team_module_bids_select ON public.bids
    USING (bids.%1$I::text = ANY (ARRAY(
      SELECT dc.id::text FROM public.demand_categories dc
      WHERE public.can_project_module_action(dc.project_id::text, 'module_pipeline', false)
    )))
  $policy$, category_column);
END $$;
COMMIT;
