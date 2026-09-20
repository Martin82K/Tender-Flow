BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';

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
 -- Mandatory collections must be usable by all readers immediately after save.
 IF jsonb_typeof(document_input->'sheets') IS DISTINCT FROM 'array'
    OR jsonb_typeof(document_input->'issues') IS DISTINCT FROM 'array'
    OR jsonb_typeof(document_input->'figures') IS DISTINCT FROM 'object'
    OR (document_input ? 'figureResolutions' AND jsonb_typeof(document_input->'figureResolutions') IS DISTINCT FROM 'object')
 THEN RAISE EXCEPTION 'Invalid budget document'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(document_input->'sheets') s
   WHERE jsonb_typeof(s) IS DISTINCT FROM 'object' OR jsonb_typeof(s->'id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(s->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(s->'selected') IS DISTINCT FROM 'boolean')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(document_input->'issues') i
   WHERE jsonb_typeof(i) IS DISTINCT FROM 'object' OR i->>'severity' IS NULL OR i->>'severity' NOT IN ('warning','error')
      OR jsonb_typeof(i->'message') IS DISTINCT FROM 'string')
 OR EXISTS(SELECT 1 FROM jsonb_each(document_input->'figures') f WHERE jsonb_typeof(f.value) IS DISTINCT FROM 'string')
 THEN RAISE EXCEPTION 'Invalid budget document'; END IF;
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
 -- Older drafts may omit optional display collections. Canonicalize their defaults;
 -- reject explicit malformed values rather than persisting a document the UI cannot render.
 document_input:=jsonb_set(document_input,'{nodes}',COALESCE((SELECT jsonb_agg(
   jsonb_build_object('tags','[]'::jsonb,'tenders','[]'::jsonb,'code','','description','','unit','','sheetId','','order',0,
     'source',jsonb_build_object('sheet','','row',0,'cells','{}'::jsonb)) || n ORDER BY position)
   FROM jsonb_array_elements(document_input->'nodes') WITH ORDINALITY AS items(n,position)),'[]'::jsonb));
 FOR node IN SELECT value FROM jsonb_array_elements(document_input->'nodes') LOOP
   IF jsonb_typeof(node->'tags') IS DISTINCT FROM 'array' OR jsonb_typeof(node->'tenders') IS DISTINCT FROM 'array'
      OR jsonb_typeof(node->'source') IS DISTINCT FROM 'object'
      OR jsonb_typeof(node#>'{source,cells}') IS DISTINCT FROM 'object'
      OR jsonb_typeof(node#>'{source,sheet}') IS DISTINCT FROM 'string'
      OR jsonb_typeof(node->'description') IS DISTINCT FROM 'string'
      OR jsonb_typeof(node->'code') IS DISTINCT FROM 'string' OR jsonb_typeof(node->'unit') IS DISTINCT FROM 'string'
   THEN RAISE EXCEPTION 'Invalid budget node shape'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(node->'tags') v WHERE jsonb_typeof(v) IS DISTINCT FROM 'string')
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(node->'tenders') v WHERE jsonb_typeof(v) IS DISTINCT FROM 'string')
   THEN RAISE EXCEPTION 'Invalid budget node shape'; END IF;
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
 -- Parse and group allocations once; never rescan the document for each allocation.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(allocations_input) a
   WHERE jsonb_typeof(a) IS DISTINCT FROM 'object' OR a->>'itemId' IS NULL OR a->>'categoryId' IS NULL
      OR a->>'quantity' IS NULL OR a->>'quantity' !~ '^-?[0-9]{1,24}(\.[0-9]{1,18})?$')
 THEN RAISE EXCEPTION 'Invalid allocation or foreign project'; END IF;
 IF EXISTS(
   WITH allocations AS MATERIALIZED (
     SELECT a->>'itemId' AS item_id,a->>'categoryId' AS category_id,(a->>'quantity')::numeric AS quantity
     FROM jsonb_array_elements(allocations_input) a
   ), totals AS (
     SELECT item_id,sum(quantity) AS used,min(quantity) AS minimum,max(quantity) AS maximum FROM allocations GROUP BY item_id
   ), nodes AS (
     SELECT n->>'id' AS id,n->>'kind' AS kind,
       CASE WHEN n->>'kind' IN ('K','M') THEN (n->>'quantity')::numeric END AS quantity
     FROM jsonb_array_elements(document_input->'nodes') n
   )
   SELECT 1 FROM totals a LEFT JOIN nodes n ON n.id=a.item_id
   WHERE n.kind IS NULL OR n.kind NOT IN ('K','M') OR n.quantity IS NULL
      OR abs(a.used)>abs(n.quantity) OR (n.quantity>=0 AND a.minimum<0) OR (n.quantity<=0 AND a.maximum>0)
   UNION ALL
   SELECT 1 FROM allocations a LEFT JOIN public.demand_categories c
     ON c.id=a.category_id AND c.project_id=project_input WHERE c.id IS NULL
 ) THEN RAISE EXCEPTION 'Invalid allocation or foreign project'; END IF;
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
