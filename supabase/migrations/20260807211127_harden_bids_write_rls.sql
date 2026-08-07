-- Bid mutations must follow project ownership or an explicit edit share.
-- Organization membership alone is intentionally insufficient. Keep the
-- existing SELECT policy unchanged so demo and read-only visibility remain
-- compatible with the application.

DROP POLICY IF EXISTS "Bids insert for project editors"
  ON public.bids;
DROP POLICY IF EXISTS "Bids update for project editors"
  ON public.bids;
DROP POLICY IF EXISTS "Bids delete for project editors"
  ON public.bids;

DO $$
DECLARE
  bid_category_column TEXT;
BEGIN
  SELECT column_name
  INTO bid_category_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'bids'
    AND column_name IN ('demand_category_id', 'category_id')
  ORDER BY CASE column_name WHEN 'demand_category_id' THEN 0 ELSE 1 END
  LIMIT 1;

  IF bid_category_column IS NULL THEN
    RAISE EXCEPTION 'Bid category column is missing on public.bids';
  END IF;

  EXECUTE format($policy$
    CREATE POLICY "Bids insert for project editors"
    ON public.bids FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.demand_categories dc
      JOIN public.projects p ON p.id = dc.project_id
      WHERE dc.id::text = bids.%1$I::text
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
        )
    ))
  $policy$, bid_category_column);

  EXECUTE format($policy$
    CREATE POLICY "Bids update for project editors"
    ON public.bids FOR UPDATE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.demand_categories dc
      JOIN public.projects p ON p.id = dc.project_id
      WHERE dc.id::text = bids.%1$I::text
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
        )
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.demand_categories dc
      JOIN public.projects p ON p.id = dc.project_id
      WHERE dc.id::text = bids.%1$I::text
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
        )
    ))
  $policy$, bid_category_column);

  EXECUTE format($policy$
    CREATE POLICY "Bids delete for project editors"
    ON public.bids FOR DELETE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.demand_categories dc
      JOIN public.projects p ON p.id = dc.project_id
      WHERE dc.id::text = bids.%1$I::text
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')
        )
    ))
  $policy$, bid_category_column);
END;
$$;
