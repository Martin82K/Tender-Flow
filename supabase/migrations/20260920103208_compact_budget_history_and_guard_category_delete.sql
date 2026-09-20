BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.construction_budget_history ADD COLUMN changes jsonb;
COMMENT ON COLUMN public.construction_budget_history.changes IS 'Reverse patch format 1: previous document fields and changed array positions; apply newest-to-oldest to the current revision. Existing full snapshots remain valid.';
CREATE FUNCTION private.budget_array_reverse_patch(before_input jsonb,after_input jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN before_input IS NOT DISTINCT FROM after_input THEN NULL ELSE
   jsonb_build_object('length',jsonb_array_length(COALESCE(before_input,'[]'::jsonb)),
     'items',COALESCE((SELECT jsonb_agg(jsonb_build_object('index',b.position-1,'value',b.value) ORDER BY b.position)
       FROM jsonb_array_elements(COALESCE(before_input,'[]'::jsonb)) WITH ORDINALITY b(value,position)
       LEFT JOIN jsonb_array_elements(COALESCE(after_input,'[]'::jsonb)) WITH ORDINALITY a(value,position) ON a.position=b.position
       WHERE b.value IS DISTINCT FROM a.value),'[]'::jsonb)) END
$$;
CREATE FUNCTION private.budget_revision_reverse_patch(before_document jsonb,after_document jsonb,before_allocations jsonb,after_allocations jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN before_document IS NULL THEN NULL
   WHEN before_document IS NOT DISTINCT FROM after_document AND before_allocations IS NOT DISTINCT FROM after_allocations THEN NULL
   ELSE jsonb_build_object('format',1,
     'fields',COALESCE((SELECT jsonb_agg(jsonb_build_object('key',COALESCE(b.key,a.key),'existed',b.key IS NOT NULL,'value',b.value) ORDER BY COALESCE(b.key,a.key))
       FROM jsonb_each(before_document-'nodes') b FULL JOIN jsonb_each(after_document-'nodes') a ON a.key=b.key
       WHERE b.value IS DISTINCT FROM a.value),'[]'::jsonb),
     'nodes',private.budget_array_reverse_patch(before_document->'nodes',after_document->'nodes'),
     'allocations',private.budget_array_reverse_patch(before_allocations,after_allocations)) END
$$;
REVOKE ALL ON FUNCTION private.budget_array_reverse_patch(jsonb,jsonb),private.budget_revision_reverse_patch(jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('private.budget_save(text,uuid,uuid,integer,text,jsonb,jsonb,boolean)'::regprocedure) INTO definition;
 IF position('previous_document,previous_allocations)' IN definition)=0
   OR position('old.version,saved.version,old.document,old.allocations)' IN definition)=0
   OR position('SELECT organization_id INTO org' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected budget save definition'; END IF;
 definition:=replace(definition,'previous_document,previous_allocations)','previous_document,previous_allocations,changes)');
 definition:=replace(definition,'old.version,saved.version,old.document,old.allocations)',
   'old.version,saved.version,NULL,NULL,private.budget_revision_reverse_patch(old.document,saved.document,old.allocations,saved.allocations))');
 -- Serialize allocation validation with category deletion. JSON references have no FK.
 definition:=replace(definition,'SELECT organization_id INTO org',
   'PERFORM pg_advisory_xact_lock(hashtextextended(''budget-categories:''||project_input,0)); SELECT organization_id INTO org');
 EXECUTE definition;
 SELECT pg_get_functiondef('private.budget_backup_restore(jsonb,uuid,text)'::regprocedure) INTO definition;
 IF position('previous_document,previous_allocations)' IN definition)=0
   OR position('item->''previous_document'',item->''previous_allocations'')' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected budget history restore definition'; END IF;
 definition:=replace(definition,'previous_document,previous_allocations)','previous_document,previous_allocations,changes)');
 definition:=replace(definition,'item->''previous_document'',item->''previous_allocations'')',
   'NULLIF(item->''previous_document'',''null''::jsonb),NULLIF(item->''previous_allocations'',''null''::jsonb),NULLIF(item->''changes'',''null''::jsonb))');
 EXECUTE definition;
END $migration$;

CREATE FUNCTION private.budget_category_delete_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('budget-categories:'||OLD.project_id,0));
 IF EXISTS(SELECT 1 FROM public.construction_budget_revisions r WHERE r.project_id=OLD.project_id
   AND r.allocations @> jsonb_build_array(jsonb_build_object('categoryId',OLD.id))) THEN
   RAISE EXCEPTION 'VŘ je přiřazené k rozpočtu. Nejprve odstraňte související revize rozpočtu včetně koše.';
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION private.budget_category_delete_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER construction_budget_category_delete_guard BEFORE DELETE ON public.demand_categories
 FOR EACH ROW EXECUTE FUNCTION private.budget_category_delete_guard();
COMMIT;
