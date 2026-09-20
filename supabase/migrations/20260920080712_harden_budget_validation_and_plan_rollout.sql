BEGIN;

CREATE OR REPLACE FUNCTION private.budget_save(project_input text,source_input uuid,revision_input uuid,version_input integer,title_input text,document_input jsonb,allocations_input jsonb,confirm_input boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.construction_budget_revisions; saved public.construction_budget_revisions; org uuid; node jsonb; allocation jsonb; tag text; allocated numeric; qty numeric;
BEGIN
 IF NOT private.budget_access(project_input,'edit') OR NOT private.budget_access(project_input,'prices') THEN RAISE EXCEPTION 'Budget edit denied' USING ERRCODE='42501'; END IF;
 IF confirm_input AND NOT private.budget_access(project_input,'confirm') THEN RAISE EXCEPTION 'Confirmation denied' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO org FROM public.projects WHERE id=project_input;
 IF NOT EXISTS(SELECT 1 FROM public.construction_budget_sources WHERE id=source_input AND project_id=project_input AND organization_id=org AND deleted_at IS NULL FOR SHARE) THEN RAISE EXCEPTION 'Invalid source'; END IF;
 IF revision_input IS NULL AND document_input->>'importKey' IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(project_input||':'||(document_input->>'importKey'),0));
   SELECT * INTO saved FROM public.construction_budget_revisions WHERE project_id=project_input AND import_key=(document_input->>'importKey')::uuid;
   IF FOUND THEN IF saved.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Nejprve obnovte revizi z koše.'; END IF; RETURN to_jsonb(saved); END IF;
 END IF;
 IF revision_input IS NOT NULL THEN
   SELECT * INTO old FROM public.construction_budget_revisions WHERE id=revision_input AND project_id=project_input FOR UPDATE;
   IF NOT FOUND OR old.deleted_at IS NOT NULL OR old.status<>'draft' OR old.version<>version_input OR old.source_id<>source_input THEN RAISE EXCEPTION 'Revision conflict; reload before retrying' USING ERRCODE='40001'; END IF;
 END IF;
 IF (revision_input IS NULL AND allocations_input<>'[]'::jsonb OR revision_input IS NOT NULL AND allocations_input IS DISTINCT FROM old.allocations)
    AND NOT private.budget_access(project_input,'allocate') THEN RAISE EXCEPTION 'Allocation denied' USING ERRCODE='42501'; END IF;
 IF document_input->>'schemaVersion' IS DISTINCT FROM '1' OR jsonb_typeof(document_input->'nodes') IS DISTINCT FROM 'array'
    OR jsonb_typeof(allocations_input) IS DISTINCT FROM 'array' OR jsonb_array_length(document_input->'nodes')>250000
    OR pg_column_size(document_input)>100000000 THEN RAISE EXCEPTION 'Invalid budget document'; END IF;
 -- Set-based validation avoids a growing array scan/copy for every node.
 -- Ordinality preserves the existing parent-before-child rule (and rejects cycles).
 IF EXISTS (
   WITH nodes AS MATERIALIZED (
     SELECT value->>'id' AS id, value->>'parentId' AS parent_id,
            value->>'kind' AS kind, ordinality AS position
     FROM jsonb_array_elements(document_input->'nodes') WITH ORDINALITY
   ), node_references AS (
     SELECT id, position, true AS is_node,
       kind IS NULL OR kind NOT IN ('object','sheet','section','K','M','VV','note','subtotal') AS invalid_kind
     FROM nodes
     UNION ALL
     SELECT parent_id, position, false, false FROM nodes WHERE parent_id IS NOT NULL
   )
   SELECT 1 FROM node_references GROUP BY id
   HAVING id IS NULL OR bool_or(invalid_kind)
     OR count(*) FILTER (WHERE is_node)<>1
     OR min(position) FILTER (WHERE NOT is_node)<=min(position) FILTER (WHERE is_node)
 ) THEN RAISE EXCEPTION 'Invalid hierarchy'; END IF;
 FOR node IN SELECT value FROM jsonb_array_elements(document_input->'nodes') LOOP
   IF length(node->>'description')>32768 THEN RAISE EXCEPTION 'Description too long'; END IF;
   IF node->>'kind' IN ('K','M') THEN
     FOREACH tag IN ARRAY ARRAY['quantity','unitPrice','total'] LOOP
       IF node->>tag IS NOT NULL AND (node->>tag !~ '^-?[0-9]{1,24}(\.[0-9]{1,18})?$') THEN RAISE EXCEPTION 'Invalid decimal'; END IF;
       IF confirm_input AND node->>tag IS NULL THEN RAISE EXCEPTION 'Incomplete priced item'; END IF;
     END LOOP;
   END IF;
   FOR tag IN SELECT jsonb_array_elements_text(COALESCE(node->'tags','[]')) LOOP
     IF NOT EXISTS(SELECT 1 FROM public.construction_budget_catalog c WHERE c.id::text=tag AND c.organization_id=org AND c.kind='tag') THEN RAISE EXCEPTION 'Invalid tag tenant'; END IF;
   END LOOP;
 END LOOP;
 IF confirm_input AND EXISTS(SELECT 1 FROM jsonb_array_elements(document_input->'issues') i WHERE i->>'severity'='error') THEN RAISE EXCEPTION 'Blocking import errors'; END IF;
 FOR allocation IN SELECT value FROM jsonb_array_elements(allocations_input) LOOP
   SELECT value INTO node FROM jsonb_array_elements(document_input->'nodes') WHERE value->>'id'=allocation->>'itemId';
   IF node IS NULL OR node->>'kind' NOT IN ('K','M') OR node->>'quantity' IS NULL
      OR allocation->>'quantity' IS NULL OR allocation->>'quantity' !~ '^-?[0-9]{1,24}(\.[0-9]{1,18})?$'
      OR NOT EXISTS(SELECT 1 FROM public.demand_categories c WHERE c.id=allocation->>'categoryId' AND c.project_id=project_input)
      THEN RAISE EXCEPTION 'Invalid allocation or foreign project'; END IF;
   qty := (node->>'quantity')::numeric;
   IF sign((allocation->>'quantity')::numeric) NOT IN (0,sign(qty)) THEN RAISE EXCEPTION 'Invalid allocation sign'; END IF;
   SELECT sum((a->>'quantity')::numeric) INTO allocated FROM jsonb_array_elements(allocations_input) a WHERE a->>'itemId'=node->>'id';
   IF abs(allocated)>abs(qty) THEN RAISE EXCEPTION 'Overallocation'; END IF;
 END LOOP;
 IF revision_input IS NULL THEN
   INSERT INTO public.construction_budget_revisions(project_id,organization_id,source_id,title,document,allocations,status,import_key)
   VALUES(project_input,org,source_input,title_input,document_input,allocations_input,CASE WHEN confirm_input THEN 'confirmed' ELSE 'draft' END,(document_input->>'importKey')::uuid) RETURNING * INTO saved;
 ELSE
   UPDATE public.construction_budget_revisions SET title=title_input,document=document_input,allocations=allocations_input,version=version+1,status=CASE WHEN confirm_input THEN 'confirmed' ELSE 'draft' END
     WHERE id=revision_input RETURNING * INTO saved;
 END IF;
 INSERT INTO public.construction_budget_history(revision_id,project_id,actor_id,event,previous_version,new_version,previous_document,previous_allocations)
 VALUES(saved.id,project_input,auth.uid(),CASE WHEN confirm_input THEN 'confirm' WHEN revision_input IS NULL THEN 'create' ELSE 'save' END,old.version,saved.version,old.document,old.allocations);
 UPDATE public.construction_budget_sources SET status='ready' WHERE id=source_input;
 RETURN to_jsonb(saved);
END $$;

-- The UI deliberately keeps plan transfer unavailable until its workflow is released.
-- Keep definitions for compatibility, but revoke both direct and wrapper entry points.
REVOKE ALL ON FUNCTION private.budget_apply_plan(text,uuid,text,numeric),
  public.construction_budget_apply_plan(text,uuid,text,numeric) FROM PUBLIC, anon, authenticated;

COMMIT;
