-- Add an idempotent path for updated clients without changing legacy INSERT or
-- backup restore semantics. Historical commercial rows must remain restorable.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE INDEX IF NOT EXISTS idx_bids_pipeline_supplier
  ON public.bids (demand_category_id, subcontractor_id);

CREATE OR REPLACE FUNCTION public.insert_pipeline_bids(p_bids jsonb)
RETURNS SETOF public.bids
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '5s'
AS $function$
DECLARE
  item jsonb;
  candidate public.bids%ROWTYPE;
BEGIN
  IF p_bids IS NULL OR jsonb_typeof(p_bids) <> 'array' THEN
    RAISE EXCEPTION 'Expected a bid array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_bids) > 1000 OR octet_length(p_bids::text) > 2097152 THEN
    RAISE EXCEPTION 'Bid batch exceeds the supported limit' USING ERRCODE = '22023';
  END IF;

  -- Lock in a stable order to avoid deadlocks between overlapping batches.
  FOR item IN
    SELECT value FROM jsonb_array_elements(p_bids)
    ORDER BY hashtextextended(jsonb_build_array(value->>'demand_category_id', value->>'subcontractor_id')::text, 0)
  LOOP
    IF jsonb_typeof(item) <> 'object'
      OR coalesce(item->>'id', '') = ''
      OR coalesce(item->>'demand_category_id', '') = ''
      OR coalesce(item->>'subcontractor_id', '') = '' THEN
      RAISE EXCEPTION 'Bid identifiers are required' USING ERRCODE = '22023';
    END IF;
    candidate := jsonb_populate_record(NULL::public.bids, item);
    PERFORM pg_advisory_xact_lock(hashtextextended(
      jsonb_build_array(candidate.demand_category_id, candidate.subcontractor_id)::text, 0
    ));

    -- This statement sees the previous lock holder's committed row under the
    -- normal READ COMMITTED API transaction. All reads/writes retain caller RLS.
    RETURN QUERY
      INSERT INTO public.bids (
        id, demand_category_id, subcontractor_id, company_name, contact_person,
        email, phone, price, price_display, notes, status, tags
      )
      SELECT candidate.id, candidate.demand_category_id, candidate.subcontractor_id,
        candidate.company_name, candidate.contact_person, candidate.email,
        candidate.phone, candidate.price, candidate.price_display, candidate.notes,
        candidate.status, candidate.tags
      WHERE NOT EXISTS (
        SELECT 1 FROM public.bids b
        WHERE b.demand_category_id = candidate.demand_category_id
          AND b.subcontractor_id = candidate.subcontractor_id
      )
      RETURNING *;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.insert_pipeline_bids(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_pipeline_bids(jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.insert_pipeline_bids(jsonb) IS
  'Idempotent additions for updated pipeline clients; SECURITY INVOKER preserves table permissions and RLS. Legacy writes and historical backup records are unchanged.';
NOTIFY pgrst, 'reload schema';
