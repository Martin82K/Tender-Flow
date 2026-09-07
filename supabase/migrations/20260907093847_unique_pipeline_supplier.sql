-- A supplier may occur in multiple tenders, but only once in each category.
-- Never resolve existing conflicts by deleting commercial records.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.bids
    WHERE demand_category_id IS NOT NULL AND subcontractor_id IS NOT NULL
    GROUP BY demand_category_id, subcontractor_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate pipeline suppliers exist; migration stopped without changing data';
  END IF;
END;
$migration$;

ALTER TABLE public.bids
  ADD CONSTRAINT bids_category_supplier_key UNIQUE (demand_category_id, subcontractor_id);

COMMENT ON CONSTRAINT bids_category_supplier_key ON public.bids IS
  'One supplier per demand category; retries must preserve the existing bid.';
