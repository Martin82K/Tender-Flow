BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
 IF position('budget_revision_reverse_patch' IN pg_get_functiondef('private.budget_save(text,uuid,uuid,integer,text,jsonb,jsonb,boolean)'::regprocedure))=0
 THEN RAISE EXCEPTION 'Compact budget history is required'; END IF;
END $preflight$;


-- Keep the existing full validator/history/lock path, but never transfer the
-- complete document over HTTP to change one cell. No new persistence lifecycle.
CREATE FUNCTION private.budget_edit_item(project_input text,request_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 base public.construction_budget_revisions; node jsonb; edited jsonb; document jsonb;
 patch jsonb:=request_input->'patch'; allocations jsonb; assigned jsonb; saved jsonb;
 position integer; issue_index integer; issue jsonb; request_version integer;
 operation uuid; source_id uuid; target_revision_id uuid; item_id text; field text;
 replay jsonb; removed jsonb:=COALESCE(request_input->'resolvedIssueIndexes','[]'::jsonb);
BEGIN
 IF auth.uid() IS NULL OR NOT private.budget_access(project_input,'read')
   OR NOT private.budget_access(project_input,'edit') OR NOT private.budget_access(project_input,'prices')
 THEN RAISE EXCEPTION 'Budget edit denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(request_input) IS DISTINCT FROM 'object' OR pg_column_size(request_input)>65536
   OR jsonb_typeof(patch) IS DISTINCT FROM 'object' OR patch='{}'::jsonb
   OR jsonb_typeof(removed) IS DISTINCT FROM 'array'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN ('kind','code','description','unit','quantity','unitPrice','total'))
 THEN RAISE EXCEPTION 'Invalid item patch'; END IF;
 operation:=(request_input->>'operationId')::uuid;source_id:=(request_input->>'sourceId')::uuid;
 target_revision_id:=(request_input->>'revisionId')::uuid;request_version:=(request_input->>'version')::integer;item_id:=request_input->>'itemId';
 IF operation IS NULL OR source_id IS NULL OR target_revision_id IS NULL OR request_version IS NULL OR item_id IS NULL
 THEN RAISE EXCEPTION 'Invalid item request'; END IF;
 -- Same lock order as the existing save/import/catalog paths.
 PERFORM pg_advisory_xact_lock(hashtextextended('budget-categories:'||project_input,0));
 PERFORM 1 FROM public.construction_budget_sources WHERE id=source_id AND project_id=project_input AND deleted_at IS NULL AND purge_job_id IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid source'; END IF;
 SELECT * INTO base FROM public.construction_budget_revisions WHERE id=target_revision_id AND project_id=project_input FOR UPDATE;
 IF NOT FOUND OR base.source_id<>source_id OR base.status<>'draft' OR base.deleted_at IS NOT NULL OR base.purge_job_id IS NOT NULL
 THEN RAISE EXCEPTION 'Revision conflict; reload before retrying' USING ERRCODE='40001'; END IF;
 PERFORM private.budget_assert_unlocked(project_input);
 IF base.version<>request_version THEN
   -- Only replay our own exact operation, with no later changes to the revision.
   SELECT changes->'clientEdit' INTO replay FROM public.construction_budget_history
    WHERE revision_id=base.id AND project_id=project_input AND actor_id=auth.uid()
      AND previous_version=request_version AND new_version=base.version ORDER BY id DESC LIMIT 1;
   IF base.version<>request_version+1 OR replay IS DISTINCT FROM request_input THEN
     RAISE EXCEPTION 'Revision conflict; reload before retrying' USING ERRCODE='40001';
   END IF;
 ELSE
   SELECT value,ordinality::integer-1 INTO node,position FROM jsonb_array_elements(base.document->'nodes') WITH ORDINALITY WHERE value->>'id'=item_id;
   IF node IS NULL OR node->>'kind' NOT IN ('K','M') THEN RAISE EXCEPTION 'Invalid item'; END IF;
   edited:=node||patch;
   IF edited->>'kind' NOT IN ('K','M') THEN RAISE EXCEPTION 'Invalid item kind'; END IF;
   FOREACH field IN ARRAY ARRAY['quantity','unitPrice','total'] LOOP
     IF edited->>field IS NOT NULL AND (jsonb_typeof(edited->field)<>'string' OR edited->>field !~ '^-?[0-9]{1,24}(\.[0-9]{1,18})?$')
     THEN RAISE EXCEPTION 'Invalid decimal'; END IF;
   END LOOP;
   IF patch ? 'quantity' OR patch ? 'unitPrice' THEN
     edited:=jsonb_set(edited,'{total}',COALESCE(to_jsonb(round((edited->>'quantity')::numeric*(edited->>'unitPrice')::numeric,2)::text),'null'::jsonb));
     IF patch ? 'total' AND patch->'total' IS DISTINCT FROM edited->'total' THEN RAISE EXCEPTION 'Invalid calculated total'; END IF;
   END IF;
   allocations:=base.allocations;
   SELECT COALESCE(jsonb_agg(value),'[]') INTO assigned FROM jsonb_array_elements(allocations) WHERE value->>'itemId'=item_id;
   IF assigned<>'[]' AND edited->'unit' IS DISTINCT FROM node->'unit' THEN RAISE EXCEPTION 'Assigned item unit cannot change'; END IF;
   IF assigned<>'[]' AND edited->'quantity' IS DISTINCT FROM node->'quantity' THEN
     IF NOT private.budget_access(project_input,'allocate') THEN RAISE EXCEPTION 'Allocation denied' USING ERRCODE='42501'; END IF;
     IF jsonb_array_length(assigned)<>1 OR (assigned->0->>'quantity')::numeric IS DISTINCT FROM (node->>'quantity')::numeric OR edited->>'quantity' IS NULL
     THEN RAISE EXCEPTION 'Consolidate whole item allocation before changing quantity'; END IF;
     SELECT jsonb_agg(CASE WHEN value->>'itemId'=item_id THEN jsonb_set(value,'{quantity}',edited->'quantity') ELSE value END ORDER BY ordinality)
       INTO allocations FROM jsonb_array_elements(allocations) WITH ORDINALITY;
   END IF;
   document:=jsonb_set(base.document,ARRAY['nodes',position::text],edited);
   FOR issue IN SELECT value FROM jsonb_array_elements(removed) LOOP
     IF jsonb_typeof(issue)<>'number' OR issue::text !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Invalid resolved issue'; END IF;
     issue_index:=issue::text::integer;
     issue:=base.document->'issues'->issue_index;
     IF issue IS NULL OR issue->>'severity'<>'error' OR issue->>'sheet' IS DISTINCT FROM node#>>'{source,sheet}'
       OR issue->'row' IS DISTINCT FROM node#>'{source,row}'
       OR NOT (issue->>'message' ~ '^Neplatná nebo chybějící hodnota [A-Z]+\.$'
         OR issue->>'message' LIKE 'Položka nemá úplné ocenění%'
         OR issue->>'message' IN ('Položka nemá vyplněné množství.','Cena po zaokrouhlení přesahuje limit 24 číslic.','Množství × jednotková cena přesahuje limit 24 číslic.'))
     THEN RAISE EXCEPTION 'Invalid resolved issue'; END IF;
   END LOOP;
   document:=jsonb_set(document,'{issues}',COALESCE((SELECT jsonb_agg(value ORDER BY ordinality) FROM jsonb_array_elements(document->'issues') WITH ORDINALITY WHERE NOT removed @> to_jsonb(ordinality-1)),'[]'::jsonb));
   saved:=private.budget_save(project_input,source_id,base.id,request_version,base.title,document,allocations,false);
   UPDATE public.construction_budget_history SET changes=COALESCE(changes,'{"format":1,"fields":[],"nodes":null,"allocations":null}'::jsonb)||jsonb_build_object('clientEdit',request_input)
     WHERE revision_id=base.id AND new_version=(saved->>'version')::integer AND actor_id=auth.uid();
   base.document:=saved->'document';base.allocations:=saved->'allocations';base.version:=(saved->>'version')::integer;
 END IF;
 SELECT value INTO node FROM jsonb_array_elements(base.document->'nodes') WHERE value->>'id'=item_id;
 RETURN jsonb_build_object('id',base.id,'version',base.version,'node',node,'resolvedIssueIndexes',removed,
   'allocations',COALESCE((SELECT jsonb_agg(value) FROM jsonb_array_elements(base.allocations) WHERE value->>'itemId'=item_id),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION private.budget_edit_item(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.budget_edit_item(text,jsonb) TO authenticated;
CREATE FUNCTION public.construction_budget_edit_item(project_input text,request_input jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_edit_item(project_input,request_input) $$;
REVOKE ALL ON FUNCTION public.construction_budget_edit_item(text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.construction_budget_edit_item(text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
