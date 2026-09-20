BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION private.budget_set_assignments(project_input text,request_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE base public.construction_budget_revisions; target_revision uuid; target_source uuid;
 expected integer; operation uuid; ids jsonb:=request_input->'itemIds'; category text:=request_input->>'categoryId';
 next_allocations jsonb; replay jsonb;
BEGIN
 IF auth.uid() IS NULL OR private.budget_access(project_input,'read') IS NOT TRUE OR private.budget_access(project_input,'edit') IS NOT TRUE
   OR private.budget_access(project_input,'prices') IS NOT TRUE OR private.budget_access(project_input,'allocate') IS NOT TRUE
 THEN RAISE EXCEPTION 'Budget allocation denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(request_input) IS DISTINCT FROM 'object' OR pg_column_size(request_input)>2000000
   OR NOT request_input ? 'categoryId' OR jsonb_typeof(request_input->'categoryId') NOT IN ('string','null')
   OR jsonb_typeof(ids) IS DISTINCT FROM 'array' OR jsonb_array_length(ids)=0 OR jsonb_array_length(ids)>250000
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(ids) x WHERE jsonb_typeof(x)<>'string')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(ids) x GROUP BY x HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Invalid assignment patch'; END IF;
 operation:=(request_input->>'operationId')::uuid;target_revision:=(request_input->>'revisionId')::uuid;
 target_source:=(request_input->>'sourceId')::uuid;expected:=(request_input->>'version')::integer;
 IF operation IS NULL OR target_revision IS NULL OR target_source IS NULL OR expected IS NULL THEN RAISE EXCEPTION 'Invalid assignment request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('budget-categories:'||project_input,0));
 PERFORM 1 FROM public.construction_budget_sources WHERE id=target_source AND project_id=project_input AND deleted_at IS NULL AND purge_job_id IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid source'; END IF;
 SELECT * INTO base FROM public.construction_budget_revisions WHERE id=target_revision AND project_id=project_input FOR UPDATE;
 IF NOT FOUND OR base.source_id<>target_source OR base.status<>'draft' OR base.deleted_at IS NOT NULL OR base.purge_job_id IS NOT NULL
 THEN RAISE EXCEPTION 'Revision conflict; reload before retrying' USING ERRCODE='40001'; END IF;
 PERFORM private.budget_assert_unlocked(project_input);
 IF base.version<>expected THEN
   SELECT changes->'clientAssignment' INTO replay FROM public.construction_budget_history
    WHERE revision_id=base.id AND project_id=project_input AND actor_id=auth.uid() AND previous_version=expected AND new_version=base.version ORDER BY id DESC LIMIT 1;
   IF base.version<>expected+1 OR replay IS DISTINCT FROM request_input THEN RAISE EXCEPTION 'Revision conflict; reload before retrying' USING ERRCODE='40001'; END IF;
 ELSE
   IF category IS NOT NULL THEN
     PERFORM 1 FROM public.demand_categories WHERE id=category AND project_id=project_input FOR SHARE;
     IF NOT FOUND THEN RAISE EXCEPTION 'Foreign or missing tender'; END IF;
   END IF;
   IF EXISTS(WITH nodes AS MATERIALIZED(SELECT n->>'id' id,n FROM jsonb_array_elements(base.document->'nodes') n)
     SELECT 1 FROM jsonb_array_elements_text(ids) x LEFT JOIN nodes ON nodes.id=x
     WHERE nodes.id IS NULL OR COALESCE(n->>'kind','') NOT IN ('K','M') OR (category IS NOT NULL AND (n->>'quantity' IS NULL OR n->>'quantity' !~ '^-?[0-9]{1,24}([.][0-9]{1,18})?$')))
   THEN RAISE EXCEPTION 'Invalid item or quantity'; END IF;
   SELECT COALESCE(jsonb_agg(a),'[]') INTO next_allocations FROM jsonb_array_elements(base.allocations) a WHERE NOT ids ? (a->>'itemId');
   IF category IS NOT NULL THEN
     -- Zero is an explicit whole-item link too; do not silently drop it.
     next_allocations:=next_allocations||COALESCE((SELECT jsonb_agg(jsonb_build_object('itemId',n->>'id','categoryId',category,'quantity',n->>'quantity') ORDER BY ordinality)
       FROM jsonb_array_elements(base.document->'nodes') WITH ORDINALITY t(n,ordinality) WHERE ids ? (n->>'id')),'[]'::jsonb);
   END IF;
   UPDATE public.construction_budget_revisions SET allocations=next_allocations,version=version+1 WHERE id=base.id AND project_id=project_input;
   INSERT INTO public.construction_budget_history(revision_id,project_id,actor_id,event,previous_version,new_version,previous_document,previous_allocations,changes)
   VALUES(base.id,project_input,auth.uid(),'save',base.version,base.version+1,NULL,NULL,
     jsonb_build_object('format',1,'fields','[]'::jsonb,'nodes',NULL,'allocations',private.budget_array_reverse_patch(base.allocations,next_allocations),'clientAssignment',request_input));
   base.version:=base.version+1;base.allocations:=next_allocations;
 END IF;
 RETURN jsonb_build_object('id',base.id,'version',base.version,'itemIds',ids,
   'allocations',COALESCE((SELECT jsonb_agg(a) FROM jsonb_array_elements(base.allocations) a WHERE ids ? (a->>'itemId')),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION private.budget_set_assignments(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.budget_set_assignments(text,jsonb) TO authenticated;
CREATE FUNCTION public.construction_budget_set_assignments(project_input text,request_input jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_set_assignments(project_input,request_input) $$;
REVOKE ALL ON FUNCTION public.construction_budget_set_assignments(text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.construction_budget_set_assignments(text,jsonb) TO authenticated;
CREATE FUNCTION private.budget_allocation_amount(node_input jsonb,quantity_input numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN node_input->>'unitPrice' IS NULL OR node_input->>'total' IS NULL OR node_input->>'quantity' IS NULL THEN NULL
   WHEN quantity_input=(node_input->>'quantity')::numeric THEN round((node_input->>'total')::numeric,2)
   ELSE round((node_input->>'total')::numeric*quantity_input/NULLIF((node_input->>'quantity')::numeric,0),2) END
$$;
REVOKE ALL ON FUNCTION private.budget_allocation_amount(jsonb,numeric) FROM PUBLIC,anon,authenticated,service_role;
-- The plan endpoint remains disabled; align its calculation without changing grants.
DO $plan$
DECLARE definition text; anchor text:='round((a->>''quantity'')::numeric*(n->>''unitPrice'')::numeric,2)';
BEGIN
 SELECT pg_get_functiondef('private.budget_apply_plan(text,uuid,text,numeric)'::regprocedure) INTO definition;
 IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Unexpected plan calculation'; END IF;
 EXECUTE replace(definition,anchor,'private.budget_allocation_amount(n,(a->>''quantity'')::numeric)');
END $plan$;
DO $legacy$
DECLARE definition text;
 guard_anchor text:='jsonb_array_length(assigned)<>1 OR (assigned->0->>''quantity'')::numeric';
 update_anchor text:='SELECT jsonb_agg(CASE WHEN value->>''itemId''=item_id THEN jsonb_set(value,''{quantity}'',edited->''quantity'') ELSE value END ORDER BY ordinality)
       INTO allocations FROM jsonb_array_elements(allocations) WITH ORDINALITY;';
BEGIN
 SELECT pg_get_functiondef('private.budget_edit_item(text,jsonb)'::regprocedure) INTO definition;
 IF position(guard_anchor IN definition)=0 OR position(update_anchor IN definition)=0 THEN RAISE EXCEPTION 'Unexpected item allocation validator'; END IF;
 definition:=replace(definition,guard_anchor,'(SELECT count(DISTINCT value->>''categoryId'') FROM jsonb_array_elements(assigned))<>1 OR (SELECT sum((value->>''quantity'')::numeric) FROM jsonb_array_elements(assigned))');
 definition:=replace(definition,update_anchor,'SELECT COALESCE(jsonb_agg(value ORDER BY ordinality),''[]''::jsonb) INTO allocations FROM jsonb_array_elements(allocations) WITH ORDINALITY WHERE value->>''itemId''<>item_id;
     allocations:=allocations||jsonb_build_array(jsonb_set(assigned->0,''{quantity}'',edited->''quantity''));');
 EXECUTE definition;
END $legacy$;
NOTIFY pgrst,'reload schema';
COMMIT;
