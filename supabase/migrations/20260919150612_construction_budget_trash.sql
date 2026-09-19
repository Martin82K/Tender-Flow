BEGIN;
ALTER TABLE public.construction_budget_revisions ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.construction_budget_sources ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
CREATE INDEX construction_budget_revisions_deleted_by_idx ON public.construction_budget_revisions(deleted_by);
CREATE INDEX construction_budget_sources_deleted_by_idx ON public.construction_budget_sources(deleted_by);

CREATE FUNCTION private.budget_trash(project_input text, target_input uuid, kind_input text, restore_input boolean, version_input integer DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rev public.construction_budget_revisions; src public.construction_budget_sources;
BEGIN
 IF NOT private.budget_access(project_input,'edit') OR NOT private.budget_access(project_input,'prices') THEN RAISE EXCEPTION 'Budget edit denied' USING ERRCODE='42501'; END IF;
 IF restore_input IS NULL THEN RAISE EXCEPTION 'Missing restore action'; END IF;
 IF kind_input='revision' THEN
   SELECT s.* INTO src FROM public.construction_budget_sources s JOIN public.construction_budget_revisions r ON r.source_id=s.id WHERE r.id=target_input AND r.project_id=project_input FOR UPDATE OF s;
   SELECT * INTO rev FROM public.construction_budget_revisions WHERE id=target_input AND project_id=project_input FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Revision not found'; END IF;
   IF rev.version IS DISTINCT FROM version_input THEN RAISE EXCEPTION 'Revision conflict; reload before retrying' USING ERRCODE='40001'; END IF;
   IF rev.status='confirmed' AND NOT private.budget_access(project_input,'confirm') THEN RAISE EXCEPTION 'Confirmation permission required' USING ERRCODE='42501'; END IF;
   IF rev.allocations<>'[]'::jsonb AND NOT private.budget_access(project_input,'allocate') THEN RAISE EXCEPTION 'Allocation permission required' USING ERRCODE='42501'; END IF;
   IF restore_input=(rev.deleted_at IS NULL) THEN RETURN; END IF;
   -- Lock the source against concurrent removal while restoring its revision.
   IF restore_input AND src.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Nejprve obnovte původní přílohu z koše.'; END IF;
   UPDATE public.construction_budget_revisions SET deleted_at=CASE WHEN restore_input THEN NULL ELSE now() END,deleted_by=CASE WHEN restore_input THEN NULL ELSE auth.uid() END,version=version+1 WHERE id=rev.id;
   INSERT INTO public.construction_budget_history(revision_id,project_id,actor_id,event,previous_version,new_version)
   VALUES(rev.id,project_input,auth.uid(),CASE WHEN restore_input THEN 'restore' ELSE 'trash' END,rev.version,rev.version+1);
 ELSIF kind_input='source' THEN
   SELECT * INTO src FROM public.construction_budget_sources WHERE id=target_input AND project_id=project_input FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Source not found'; END IF;
   IF NOT restore_input AND EXISTS(SELECT 1 FROM public.construction_budget_revisions WHERE source_id=src.id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Přílohu používají aktivní revize. Nejprve je přesuňte do koše.'; END IF;
   UPDATE public.construction_budget_sources SET deleted_at=CASE WHEN restore_input THEN NULL ELSE now() END,deleted_by=CASE WHEN restore_input THEN NULL ELSE auth.uid() END WHERE id=src.id;
 ELSE RAISE EXCEPTION 'Invalid target kind'; END IF;
END $$;
CREATE FUNCTION public.construction_budget_trash(project_input text,target_input uuid,kind_input text,restore_input boolean,version_input integer DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_trash(project_input,target_input,kind_input,restore_input,version_input) $$;
REVOKE ALL ON FUNCTION private.budget_trash(text,uuid,text,boolean,integer),public.construction_budget_trash(text,uuid,text,boolean,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.budget_trash(text,uuid,text,boolean,integer),public.construction_budget_trash(text,uuid,text,boolean,integer) TO authenticated;


CREATE OR REPLACE FUNCTION private.budget_load(project_input text, revision_input uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; prices boolean;
BEGIN
 IF NOT private.budget_access(project_input,'read') THEN RAISE EXCEPTION 'Budget access denied' USING ERRCODE='42501'; END IF;
 prices := private.budget_access(project_input,'prices');
 IF revision_input IS NULL THEN
   SELECT jsonb_build_object('permissions',jsonb_build_object('read',true,'prices',prices,'edit',private.budget_access(project_input,'edit'),'confirm',private.budget_access(project_input,'confirm'),'allocate',private.budget_access(project_input,'allocate')),
     'revisions',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'version',r.version,'source_id',r.source_id,'created_at',r.created_at,'deleted_at',r.deleted_at,'allocation_count',jsonb_array_length(r.allocations),'category_ids',(SELECT COALESCE(jsonb_agg(DISTINCT a->>'categoryId'),'[]'::jsonb) FROM jsonb_array_elements(r.allocations) a)) ORDER BY r.created_at DESC) FROM public.construction_budget_revisions r WHERE r.project_id=project_input),'[]'::jsonb)) INTO result;
 ELSE
   SELECT to_jsonb(r) INTO result FROM public.construction_budget_revisions r WHERE r.id=revision_input AND r.project_id=project_input;
   IF result IS NULL THEN RAISE EXCEPTION 'Revision not found'; END IF;
   IF NOT prices THEN
     result := jsonb_set(result,'{document,nodes}',COALESCE((SELECT jsonb_agg(n||jsonb_build_object('unitPrice',NULL,'total',NULL,'source',jsonb_build_object('sheet',n#>>'{source,sheet}','row',n#>'{source,row}','cells','{}'::jsonb))) FROM jsonb_array_elements(result#>'{document,nodes}') n),'[]'::jsonb));
   END IF;
 END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION private.budget_source(project_input text,filename_input text,hash_input text,status_input text DEFAULT 'attachment') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; source public.construction_budget_sources;
BEGIN
 IF NOT private.budget_access(project_input,'edit') OR NOT private.budget_access(project_input,'prices') THEN RAISE EXCEPTION 'Budget edit denied' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO org FROM public.projects WHERE id=project_input;
 SELECT * INTO source FROM public.construction_budget_sources WHERE project_id=project_input AND sha256=hash_input;
 IF NOT FOUND THEN
   source.id := gen_random_uuid();
   INSERT INTO public.construction_budget_sources(id,project_id,organization_id,filename,sha256,storage_path,status)
   VALUES(source.id,project_input,org,filename_input,hash_input,org::text||'/'||source.id::text||'/source.xlsx',status_input)
   ON CONFLICT(project_id,sha256) DO NOTHING;
   SELECT * INTO source FROM public.construction_budget_sources WHERE project_id=project_input AND sha256=hash_input;
 ELSE
   IF source.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Nejprve obnovte přílohu z koše.'; END IF;
   UPDATE public.construction_budget_sources SET status=status_input WHERE id=source.id RETURNING * INTO source;
 END IF;
 RETURN to_jsonb(source);
END $$;

CREATE OR REPLACE FUNCTION private.budget_save(project_input text,source_input uuid,revision_input uuid,version_input integer,title_input text,document_input jsonb,allocations_input jsonb,confirm_input boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.construction_budget_revisions; saved public.construction_budget_revisions; org uuid; node jsonb; allocation jsonb; ids text[] := '{}'; tag text; allocated numeric; qty numeric;
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
 FOR node IN SELECT value FROM jsonb_array_elements(document_input->'nodes') LOOP
   IF node->>'id' IS NULL OR node->>'id'=ANY(ids) OR node->>'kind' NOT IN ('object','sheet','section','K','M','VV','note','subtotal')
      OR (node->>'parentId' IS NOT NULL AND NOT node->>'parentId'=ANY(ids)) THEN RAISE EXCEPTION 'Invalid hierarchy'; END IF;
   ids := array_append(ids,node->>'id');
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

CREATE OR REPLACE FUNCTION private.budget_apply_plan(project_input text,revision_input uuid,category_input text,expected_plan numeric) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rev public.construction_budget_revisions; previous numeric; calculated numeric; org uuid; owner uuid;
BEGIN
 IF NOT private.budget_access(project_input,'prices') OR NOT private.budget_access(project_input,'allocate')
    OR NOT public.can_project_module_action(project_input,'module_pipeline',true) THEN RAISE EXCEPTION 'Plan transfer denied' USING ERRCODE='42501'; END IF;
 SELECT organization_id,owner_id INTO org,owner FROM public.projects WHERE id=project_input;
 IF owner<>auth.uid() AND NOT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.organization_role_permissions rp ON rp.organization_id=m.organization_id AND rp.role_key=m.professional_role
   WHERE m.organization_id=org AND m.user_id=auth.uid() AND m.is_active AND rp.permission_key='tenders.plan' AND rp.access_level='write') THEN RAISE EXCEPTION 'Tender plan permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO rev FROM public.construction_budget_revisions WHERE id=revision_input AND project_id=project_input FOR SHARE;
 IF NOT FOUND OR rev.deleted_at IS NOT NULL OR rev.status<>'confirmed' THEN RAISE EXCEPTION 'Confirm the source revision first'; END IF;
 SELECT plan_budget INTO previous FROM public.demand_categories WHERE id=category_input AND project_id=project_input FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Foreign or missing tender'; END IF;
 IF COALESCE(previous,0) IS DISTINCT FROM expected_plan THEN RAISE EXCEPTION 'Tender plan changed; reload preview' USING ERRCODE='40001'; END IF;
 SELECT sum(round((a->>'quantity')::numeric*(n->>'unitPrice')::numeric,2)) INTO calculated
 FROM jsonb_array_elements(rev.allocations) a JOIN jsonb_array_elements(rev.document->'nodes') n ON n->>'id'=a->>'itemId'
 WHERE a->>'categoryId'=category_input;
 IF calculated IS NULL THEN RAISE EXCEPTION 'No allocated priced items'; END IF;
 UPDATE public.demand_categories SET plan_budget=calculated WHERE id=category_input AND project_id=project_input;
 INSERT INTO public.construction_budget_history(revision_id,project_id,actor_id,event,previous_version,new_version,previous_document)
 VALUES(rev.id,project_input,auth.uid(),'apply_tender_plan',rev.version,rev.version,jsonb_build_object('categoryId',category_input,'previousPlan',previous,'newPlan',calculated,'sourceId',rev.source_id));
 RETURN calculated;
END $$;
COMMIT;
