BEGIN;
-- Every deletion path, including PostgREST and parent cascades, clears legacy provenance.
CREATE FUNCTION public.clear_deleted_contract_source_link() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE public.contracts SET source_bid_id=NULL WHERE id=OLD.contract_id AND source_bid_id=OLD.bid_id;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.clear_deleted_contract_source_link() FROM PUBLIC, anon;
CREATE TRIGGER clear_deleted_contract_source_link AFTER DELETE ON public.contract_bid_links
FOR EACH ROW EXECUTE FUNCTION public.clear_deleted_contract_source_link();
-- MCP retains its existing contract permissions and gains only the corresponding link IDs.
GRANT SELECT ON public.contract_bid_links TO tenderflow_mcp_client;
CREATE POLICY contract_bid_links_mcp_read ON public.contract_bid_links FOR SELECT TO tenderflow_mcp_client
USING (EXISTS(SELECT 1 FROM public.contracts c WHERE c.id=contract_id));

DO $migration$
DECLARE kind text; definition text; signature regprocedure;
BEGIN
  FOREACH kind IN ARRAY ARRAY['user','tenant'] LOOP
    -- Enrich before the original history write, so counts and bytes describe the returned manifest.
    signature := format('public.export_%s_backup_before_shared_tenders(uuid)',kind)::regprocedure;
    SELECT pg_get_functiondef(signature) INTO definition;
    IF position('rec_counts := jsonb_build_object(' IN definition)=0 THEN RAISE EXCEPTION 'Unknown backup exporter shape'; END IF;
    definition := replace(definition, 'rec_counts := jsonb_build_object(', $patch$
      result := jsonb_set(result, '{contracts}', COALESCE((
        SELECT jsonb_agg(item || jsonb_build_object('contract_bid_links', COALESCE((
          SELECT jsonb_agg(to_jsonb(l)) FROM public.contract_bid_links l WHERE l.contract_id=(item->>'id')::uuid
        ), '[]'::jsonb))) FROM jsonb_array_elements(result->'contracts') item
      ), '[]'::jsonb));
      rec_counts := jsonb_build_object(
        'contract_bid_links', (SELECT COALESCE(sum(jsonb_array_length(item->'contract_bid_links')),0) FROM jsonb_array_elements(result->'contracts') item),
    $patch$);
    EXECUTE definition;
    EXECUTE format('ALTER FUNCTION %s SET search_path = %L',signature,'');
    signature := format('public.restore_%s_backup(jsonb,uuid)',kind)::regprocedure;
    SELECT pg_get_functiondef(signature) INTO definition;
    IF position('IF c.id IS NULL THEN CONTINUE; END IF;' IN definition)=0 THEN RAISE EXCEPTION 'Unknown backup restorer shape'; END IF;
    definition := replace(definition,'IF c.id IS NULL THEN CONTINUE; END IF;', $patch$
      IF c.id IS NULL THEN CONTINUE; END IF;
      IF auth.uid() IS NULL OR NOT public.has_active_subscription()
        OR NOT public.user_has_feature('module_contracts')
        OR NOT public.can_project_module_action(c.project_id::text,'module_contracts',true)
        OR NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=c.project_id AND
          (p.owner_id=auth.uid() OR EXISTS(SELECT 1 FROM public.project_shares ps WHERE ps.project_id=p.id AND ps.user_id=auth.uid() AND ps.permission='edit'))) THEN
        RAISE EXCEPTION 'Project is not writable for restored contract links' USING ERRCODE='42501';
      END IF;
    $patch$);
    -- Keep functions created by the deployed version compatible with either historical column.
    definition := replace(definition,'b.demand_category_id', $column$COALESCE(to_jsonb(b)->>'demand_category_id',to_jsonb(b)->>'category_id')$column$);
    EXECUTE definition;
  END LOOP;
END $migration$;
-- The original source-link trigger may already exist from the deployed migration.
DO $$ DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.sync_contract_source_bid_link()'::regprocedure) INTO definition;
  EXECUTE replace(definition,'b.demand_category_id', $column$COALESCE(to_jsonb(b)->>'demand_category_id',to_jsonb(b)->>'category_id')$column$);
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
