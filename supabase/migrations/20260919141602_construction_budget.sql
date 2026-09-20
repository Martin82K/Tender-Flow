BEGIN;
-- Source files contain prices. Only price readers may download originals.
CREATE TABLE public.construction_budget_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  filename text NOT NULL CHECK (length(filename) BETWEEN 1 AND 255),
  storage_path text NOT NULL UNIQUE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'attachment' CHECK (status IN ('attachment','processing','ready','failed','cancelled')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,sha256), UNIQUE(id,project_id,organization_id)
);
CREATE INDEX construction_budget_sources_project_idx ON public.construction_budget_sources(project_id);
CREATE INDEX construction_budget_sources_org_idx ON public.construction_budget_sources(organization_id);
CREATE INDEX construction_budget_sources_actor_idx ON public.construction_budget_sources(created_by);
CREATE TABLE public.construction_budget_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  source_id uuid NOT NULL,
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed')),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  document jsonb NOT NULL,
  import_key uuid,
  UNIQUE(project_id,import_key),
  allocations jsonb NOT NULL DEFAULT '[]',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(source_id,project_id,organization_id) REFERENCES public.construction_budget_sources(id,project_id,organization_id)
);
CREATE INDEX construction_budget_revisions_project_idx ON public.construction_budget_revisions(project_id,created_at DESC);
CREATE INDEX construction_budget_revisions_source_idx ON public.construction_budget_revisions(source_id,project_id,organization_id);
CREATE INDEX construction_budget_revisions_org_idx ON public.construction_budget_revisions(organization_id);
CREATE INDEX construction_budget_revisions_actor_idx ON public.construction_budget_revisions(created_by);
CREATE TABLE public.construction_budget_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
  kind text NOT NULL CHECK(kind IN ('tag','profession','unit','type')),
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
  color text NOT NULL DEFAULT '#64748b' CHECK(color ~ '^#[a-fA-F0-9]{6}$'), archived boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX construction_budget_catalog_name_idx ON public.construction_budget_catalog(organization_id,kind,lower(btrim(name)));
CREATE TABLE public.construction_budget_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  revision_id uuid NOT NULL REFERENCES public.construction_budget_revisions(id),
  project_id text NOT NULL REFERENCES public.projects(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL, previous_version integer, new_version integer,
  previous_document jsonb, previous_allocations jsonb
);
CREATE INDEX construction_budget_history_revision_idx ON public.construction_budget_history(revision_id);
CREATE INDEX construction_budget_history_project_idx ON public.construction_budget_history(project_id);
CREATE INDEX construction_budget_history_actor_idx ON public.construction_budget_history(actor_id);

-- Private implementation is used because public tables must never expose prices to non-price readers.
-- Every entry point independently validates the authenticated actor and the project tenant.
CREATE FUNCTION private.budget_access(project_input text, action_input text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((SELECT auth.uid() IS NOT NULL
   AND public.has_project_subscription(p.id)
   AND public.can_project_action(p.id,CASE WHEN action_input IN ('read','prices') THEN 'view' ELSE 'edit' END)
   AND EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=p.organization_id AND m.user_id=auth.uid() AND m.is_active)
   AND (p.owner_id=auth.uid() OR EXISTS(
     SELECT 1 FROM public.organization_members m JOIN public.organization_role_permissions rp
       ON rp.organization_id=m.organization_id AND rp.role_key=m.professional_role
     WHERE m.organization_id=p.organization_id AND m.user_id=auth.uid() AND m.is_active
       AND rp.permission_key='budget.'||action_input
       AND CASE WHEN action_input IN ('read','prices') THEN rp.access_level IN ('read','write')
                WHEN action_input='confirm' THEN rp.access_level='write' AND rp.can_approve
                ELSE rp.access_level='write' END))
 FROM public.projects p WHERE p.id=project_input),false)
$$;
REVOKE ALL ON FUNCTION private.budget_access(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.budget_access(text,text) TO authenticated;

ALTER TABLE public.construction_budget_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_budget_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_budget_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_budget_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.construction_budget_sources,public.construction_budget_revisions,public.construction_budget_catalog,public.construction_budget_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.construction_budget_sources,public.construction_budget_history TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.construction_budget_catalog TO authenticated;
CREATE POLICY budget_sources_read ON public.construction_budget_sources FOR SELECT TO authenticated USING(private.budget_access(project_id,'read'));
CREATE POLICY budget_revisions_read ON public.construction_budget_revisions FOR SELECT TO authenticated USING(private.budget_access(project_id,'read') AND private.budget_access(project_id,'prices'));
CREATE POLICY budget_history_read ON public.construction_budget_history FOR SELECT TO authenticated USING(private.budget_access(project_id,'read') AND private.budget_access(project_id,'prices'));
CREATE POLICY budget_catalog_read ON public.construction_budget_catalog FOR SELECT TO authenticated USING(public.is_org_member(organization_id) AND public.has_resource_subscription(organization_id));
CREATE POLICY budget_catalog_insert ON public.construction_budget_catalog FOR INSERT TO authenticated WITH CHECK(public.is_active_org_admin_or_owner(organization_id) AND public.has_resource_subscription(organization_id));
CREATE POLICY budget_catalog_update ON public.construction_budget_catalog FOR UPDATE TO authenticated USING(public.is_active_org_admin_or_owner(organization_id) AND public.has_resource_subscription(organization_id)) WITH CHECK(public.is_active_org_admin_or_owner(organization_id) AND public.has_resource_subscription(organization_id));

CREATE FUNCTION private.budget_load(project_input text, revision_input uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; prices boolean;
BEGIN
 IF NOT private.budget_access(project_input,'read') THEN RAISE EXCEPTION 'Budget access denied' USING ERRCODE='42501'; END IF;
 prices := private.budget_access(project_input,'prices');
 IF revision_input IS NULL THEN
   SELECT jsonb_build_object('permissions',jsonb_build_object('read',true,'prices',prices,'edit',private.budget_access(project_input,'edit'),'confirm',private.budget_access(project_input,'confirm'),'allocate',private.budget_access(project_input,'allocate')),
     'revisions',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'version',r.version,'source_id',r.source_id,'created_at',r.created_at) ORDER BY r.created_at DESC) FROM public.construction_budget_revisions r WHERE r.project_id=project_input),'[]'::jsonb)) INTO result;
 ELSE
   SELECT to_jsonb(r) INTO result FROM public.construction_budget_revisions r WHERE r.id=revision_input AND r.project_id=project_input;
   IF result IS NULL THEN RAISE EXCEPTION 'Revision not found'; END IF;
   IF NOT prices THEN
     result := jsonb_set(result,'{document,nodes}',COALESCE((SELECT jsonb_agg(n||jsonb_build_object('unitPrice',NULL,'total',NULL,'source',jsonb_build_object('sheet',n#>>'{source,sheet}','row',n#>'{source,row}','cells','{}'::jsonb))) FROM jsonb_array_elements(result#>'{document,nodes}') n),'[]'::jsonb));
   END IF;
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.construction_budget_load(project_input text,revision_input uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_load(project_input,revision_input) $$;

CREATE FUNCTION private.budget_source(project_input text,filename_input text,hash_input text,status_input text DEFAULT 'attachment') RETURNS jsonb
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
   UPDATE public.construction_budget_sources SET status=status_input WHERE id=source.id RETURNING * INTO source;
 END IF;
 RETURN to_jsonb(source);
END $$;
CREATE FUNCTION public.construction_budget_source(project_input text,filename_input text,hash_input text,status_input text DEFAULT 'attachment') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_source(project_input,filename_input,hash_input,status_input) $$;

CREATE FUNCTION private.budget_save(project_input text,source_input uuid,revision_input uuid,version_input integer,title_input text,document_input jsonb,allocations_input jsonb,confirm_input boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.construction_budget_revisions; saved public.construction_budget_revisions; org uuid; node jsonb; allocation jsonb; ids text[] := '{}'; tag text; allocated numeric; qty numeric;
BEGIN
 IF NOT private.budget_access(project_input,'edit') OR NOT private.budget_access(project_input,'prices') THEN RAISE EXCEPTION 'Budget edit denied' USING ERRCODE='42501'; END IF;
 IF confirm_input AND NOT private.budget_access(project_input,'confirm') THEN RAISE EXCEPTION 'Confirmation denied' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO org FROM public.projects WHERE id=project_input;
 IF NOT EXISTS(SELECT 1 FROM public.construction_budget_sources WHERE id=source_input AND project_id=project_input AND organization_id=org) THEN RAISE EXCEPTION 'Invalid source'; END IF;
 IF revision_input IS NULL AND document_input->>'importKey' IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(project_input||':'||(document_input->>'importKey'),0));
   SELECT * INTO saved FROM public.construction_budget_revisions WHERE project_id=project_input AND import_key=(document_input->>'importKey')::uuid;
   IF FOUND THEN RETURN to_jsonb(saved); END IF;
 END IF;
 IF revision_input IS NOT NULL THEN
   SELECT * INTO old FROM public.construction_budget_revisions WHERE id=revision_input AND project_id=project_input FOR UPDATE;
   IF NOT FOUND OR old.status<>'draft' OR old.version<>version_input OR old.source_id<>source_input THEN RAISE EXCEPTION 'Revision conflict; reload before retrying' USING ERRCODE='40001'; END IF;
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
CREATE FUNCTION public.construction_budget_save(project_input text,source_input uuid,revision_input uuid,version_input integer,title_input text,document_input jsonb,allocations_input jsonb,confirm_input boolean DEFAULT false) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_save(project_input,source_input,revision_input,version_input,title_input,document_input,allocations_input,confirm_input) $$;

REVOKE ALL ON FUNCTION private.budget_load(text,uuid),private.budget_source(text,text,text,text),private.budget_save(text,uuid,uuid,integer,text,jsonb,jsonb,boolean),public.construction_budget_load(text,uuid),public.construction_budget_source(text,text,text,text),public.construction_budget_save(text,uuid,uuid,integer,text,jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.budget_load(text,uuid),private.budget_source(text,text,text,text),private.budget_save(text,uuid,uuid,integer,text,jsonb,jsonb,boolean),public.construction_budget_load(text,uuid),public.construction_budget_source(text,text,text,text),public.construction_budget_save(text,uuid,uuid,integer,text,jsonb,jsonb,boolean) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('construction-budgets','construction-budgets',false,31457280,ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream']);
CREATE POLICY construction_budget_files_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='construction-budgets' AND EXISTS(SELECT 1 FROM public.construction_budget_sources s WHERE s.storage_path=name AND private.budget_access(s.project_id,'read') AND private.budget_access(s.project_id,'prices')));
CREATE POLICY construction_budget_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='construction-budgets' AND EXISTS(SELECT 1 FROM public.construction_budget_sources s WHERE s.storage_path=name AND private.budget_access(s.project_id,'edit') AND private.budget_access(s.project_id,'prices')));
-- Intentionally no file UPDATE/DELETE and no direct revision write grants: originals and confirmed revisions are immutable.
-- Explicit, separately authorized transfer into the existing tender plan.
CREATE FUNCTION private.budget_apply_plan(project_input text,revision_input uuid,category_input text,expected_plan numeric) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rev public.construction_budget_revisions; previous numeric; calculated numeric; org uuid; owner uuid;
BEGIN
 IF NOT private.budget_access(project_input,'prices') OR NOT private.budget_access(project_input,'allocate')
    OR NOT public.can_project_module_action(project_input,'module_pipeline',true) THEN RAISE EXCEPTION 'Plan transfer denied' USING ERRCODE='42501'; END IF;
 SELECT organization_id,owner_id INTO org,owner FROM public.projects WHERE id=project_input;
 IF owner<>auth.uid() AND NOT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.organization_role_permissions rp ON rp.organization_id=m.organization_id AND rp.role_key=m.professional_role
   WHERE m.organization_id=org AND m.user_id=auth.uid() AND m.is_active AND rp.permission_key='tenders.plan' AND rp.access_level='write') THEN RAISE EXCEPTION 'Tender plan permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO rev FROM public.construction_budget_revisions WHERE id=revision_input AND project_id=project_input FOR SHARE;
 IF NOT FOUND OR rev.status<>'confirmed' THEN RAISE EXCEPTION 'Confirm the source revision first'; END IF;
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
CREATE FUNCTION public.construction_budget_apply_plan(project_input text,revision_input uuid,category_input text,expected_plan numeric) RETURNS numeric LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_apply_plan(project_input,revision_input,category_input,expected_plan) $$;
REVOKE ALL ON FUNCTION private.budget_apply_plan(text,uuid,text,numeric),public.construction_budget_apply_plan(text,uuid,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.budget_apply_plan(text,uuid,text,numeric),public.construction_budget_apply_plan(text,uuid,text,numeric) TO authenticated;

COMMIT;
