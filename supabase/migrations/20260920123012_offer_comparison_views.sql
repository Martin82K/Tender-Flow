BEGIN;
-- Derived views only: never updates bids, budget revisions or source documents.
CREATE TABLE public.offer_comparison_views (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 category_id text,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=12000000),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 request_id uuid NOT NULL,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,request_id),
 FOREIGN KEY(category_id,project_id) REFERENCES public.demand_categories(id,project_id) ON DELETE CASCADE
);
CREATE INDEX offer_comparison_project_idx ON public.offer_comparison_views(project_id,updated_at DESC);
CREATE INDEX offer_comparison_category_idx ON public.offer_comparison_views(category_id,project_id);
CREATE INDEX offer_comparison_org_idx ON public.offer_comparison_views(organization_id);
CREATE INDEX offer_comparison_actor_idx ON public.offer_comparison_views(created_by);
ALTER TABLE public.offer_comparison_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offer_comparison_views FROM PUBLIC,anon,authenticated,tenderflow_mcp_client;

-- One organization lock serializes quotas across projects, including signed restores.
CREATE FUNCTION private.offer_comparison_storage_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE project_count bigint; project_bytes bigint; org_count bigint; org_bytes bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=NEW.project_id AND organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Comparison project organization mismatch'; END IF;
 IF TG_OP='UPDATE' AND (NEW.project_id<>OLD.project_id OR NEW.organization_id<>OLD.organization_id) THEN RAISE EXCEPTION 'Comparison ownership cannot change'; END IF;
 PERFORM id FROM public.organizations WHERE id=NEW.organization_id FOR UPDATE;
 -- ON CONFLICT retries do not consume an extra slot; the save RPC checks identical content.
 IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM public.offer_comparison_views WHERE id=NEW.id OR (project_id=NEW.project_id AND request_id=NEW.request_id)) THEN RETURN NEW; END IF;
 SELECT count(*) FILTER(WHERE project_id=NEW.project_id),COALESCE(sum(octet_length(document::text)) FILTER(WHERE project_id=NEW.project_id),0),count(*),COALESCE(sum(octet_length(document::text)),0)
 INTO project_count,project_bytes,org_count,org_bytes FROM public.offer_comparison_views WHERE organization_id=NEW.organization_id AND id<>NEW.id;
 IF project_count+1>20 OR project_bytes+octet_length(NEW.document::text)>16000000 OR org_count+1>100 OR org_bytes+octet_length(NEW.document::text)>32000000 THEN
  RAISE EXCEPTION 'Comparison storage quota exceeded; delete obsolete views' USING ERRCODE='54000';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.offer_comparison_storage_guard() FROM PUBLIC,anon,authenticated,tenderflow_mcp_client,service_role;
CREATE TRIGGER offer_comparison_storage_guard BEFORE INSERT OR UPDATE ON public.offer_comparison_views FOR EACH ROW EXECUTE FUNCTION private.offer_comparison_storage_guard();

CREATE FUNCTION private.offer_comparison_access(project_input text,write_input boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL
 AND public.can_project_module_action(project_input,'module_pipeline',write_input)
 AND EXISTS(SELECT 1 FROM public.projects p JOIN public.organization_members m ON m.organization_id=p.organization_id
   LEFT JOIN public.organization_role_permissions rp ON rp.organization_id=m.organization_id AND rp.role_key=m.professional_role AND rp.permission_key='tenders.bids'
   WHERE p.id=project_input AND m.user_id=auth.uid() AND m.is_active
    AND (p.owner_id=auth.uid() OR CASE WHEN write_input THEN rp.access_level='write' ELSE rp.access_level IN ('read','write') END))
 AND (COALESCE(auth.jwt()->>'role','') <> 'tenderflow_mcp_client' OR
   (public.mcp_has_permission('tenderflow.read') AND public.mcp_has_permission('tenderflow.contacts.read')
    AND (NOT write_input OR (public.mcp_has_permission('tenderflow.write') AND public.mcp_has_permission('tenderflow.bids.offer.write')))))
$$;
REVOKE ALL ON FUNCTION private.offer_comparison_access(text,boolean) FROM PUBLIC,anon;

CREATE FUNCTION private.offer_comparison_document_access(project_input text,document_input jsonb) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM jsonb_array_elements(document_input->'sources') s WHERE s->>'origin'='budget')
 OR private.budget_access(project_input,'read') IS TRUE
$$;
REVOKE ALL ON FUNCTION private.offer_comparison_document_access(text,jsonb) FROM PUBLIC,anon,authenticated,tenderflow_mcp_client;

CREATE FUNCTION private.offer_comparison_load(project_input text,id_input uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF private.offer_comparison_access(project_input,false) IS NOT TRUE THEN RAISE EXCEPTION 'Comparison access denied' USING ERRCODE='42501'; END IF;
 IF id_input IS NULL THEN
  RETURN jsonb_build_object('canEdit',private.offer_comparison_access(project_input,true),'views',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title,'category_id',category_id,'version',version,'updated_at',updated_at) ORDER BY updated_at DESC) FROM public.offer_comparison_views WHERE project_id=project_input AND private.offer_comparison_document_access(project_input,document)),'[]'::jsonb));
 END IF;
 IF EXISTS(SELECT 1 FROM public.offer_comparison_views v WHERE v.project_id=project_input AND v.id=id_input AND private.offer_comparison_document_access(project_input,v.document) IS NOT TRUE) THEN RAISE EXCEPTION 'Budget read denied' USING ERRCODE='42501'; END IF;
 RETURN (SELECT to_jsonb(v) FROM public.offer_comparison_views v WHERE project_id=project_input AND id=id_input);
END $$;
CREATE FUNCTION public.offer_comparison_load(project_input text,id_input uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.offer_comparison_load(project_input,id_input) $$;

CREATE FUNCTION private.offer_comparison_save(project_input text,id_input uuid,version_input integer,request_input uuid,title_input text,category_input text,document_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; result public.offer_comparison_views; source jsonb; item jsonb; link jsonb; links jsonb; source_ids text[]:=ARRAY[]::text[]; base_ids jsonb; offer_ids jsonb; base_count integer; work_count bigint; key text;
BEGIN
 IF private.offer_comparison_access(project_input,true) IS NOT TRUE THEN RAISE EXCEPTION 'Comparison edit denied' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO org FROM public.projects WHERE id=project_input;
 -- A creation retry only compares the immutable request payload; do not revalidate every row.
 IF id_input IS NULL AND request_input IS NOT NULL THEN
  SELECT * INTO result FROM public.offer_comparison_views WHERE project_id=project_input AND request_id=request_input;
  IF FOUND THEN
   IF private.offer_comparison_document_access(project_input,result.document) IS NOT TRUE THEN RAISE EXCEPTION 'Budget read denied' USING ERRCODE='42501'; END IF;
   IF result.document IS DISTINCT FROM document_input OR result.title IS DISTINCT FROM title_input OR result.category_id IS DISTINCT FROM category_input THEN RAISE EXCEPTION 'Request already used for another comparison' USING ERRCODE='40001'; END IF;
   RETURN to_jsonb(result);
  END IF;
 END IF;
 IF request_input IS NULL OR document_input IS NULL OR jsonb_typeof(document_input) <> 'object' OR document_input->>'schemaVersion' IS DISTINCT FROM '1'
 OR jsonb_typeof(document_input->'sources') IS DISTINCT FROM 'array' OR jsonb_array_length(document_input->'sources') NOT BETWEEN 2 AND 21
 OR jsonb_typeof(document_input->'assignments') IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'Invalid comparison document'; END IF;
 IF octet_length(document_input::text)>12000000 OR jsonb_array_length(document_input->'sources'->0->'items')=0 THEN RAISE EXCEPTION 'Invalid comparison size or empty inquiry'; END IF;
 -- Bound total work before procedural validation, independently of JSON byte size.
 SELECT COALESCE(sum(CASE WHEN jsonb_typeof(value->'items')='array' THEN jsonb_array_length(value->'items') ELSE 0 END),0) INTO work_count FROM jsonb_array_elements(document_input->'sources');
 IF work_count>50000 THEN RAISE EXCEPTION 'Comparison validation work limit exceeded'; END IF;
 SELECT COALESCE(sum(CASE WHEN jsonb_typeof(value)='array' THEN jsonb_array_length(value) ELSE 0 END),0) INTO work_count FROM jsonb_each(document_input->'assignments');
 IF work_count>50000 THEN RAISE EXCEPTION 'Comparison validation work limit exceeded'; END IF;
 SELECT COALESCE(sum(CASE WHEN jsonb_typeof(candidate_link->'candidates')='array' THEN jsonb_array_length(candidate_link->'candidates') ELSE 0 END),0) INTO work_count
 FROM jsonb_each(document_input->'assignments') assignment CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(assignment.value)='array' THEN assignment.value ELSE '[]'::jsonb END) candidate_link;
 IF work_count>200000 THEN RAISE EXCEPTION 'Comparison validation work limit exceeded'; END IF;
 FOR source IN SELECT value FROM jsonb_array_elements(document_input->'sources') LOOP
  IF jsonb_typeof(source->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(source->'items') NOT BETWEEN 0 AND 10000
   OR COALESCE(source->>'sha256','') !~ '^[a-f0-9]{64}$' OR length(COALESCE(source->>'name','')) NOT BETWEEN 1 AND 255
  THEN RAISE EXCEPTION 'Invalid comparison source'; END IF;
  IF jsonb_typeof(source->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(source->'name') IS DISTINCT FROM 'string'
   OR jsonb_typeof(source->'sha256') IS DISTINCT FROM 'string' OR COALESCE(source->>'origin','') NOT IN ('file','budget','mcp')
   OR length(COALESCE(source->>'id','')) NOT BETWEEN 1 AND 200 OR source->>'id'=ANY(source_ids)
   OR jsonb_typeof(source->'notes') IS DISTINCT FROM 'array' OR jsonb_array_length(source->'notes')>10000
  THEN RAISE EXCEPTION 'Invalid source identity or notes'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(source->'notes') n WHERE jsonb_typeof(n) IS DISTINCT FROM 'string' OR length(n#>>'{}')>4000) THEN RAISE EXCEPTION 'Invalid source notes'; END IF;
  source_ids:=array_append(source_ids,source->>'id');
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(source->'items') entry WHERE jsonb_typeof(entry->'id') IS DISTINCT FROM 'string' OR length(COALESCE(entry->>'id','')) NOT BETWEEN 1 AND 200)
   OR (SELECT count(*)<>count(DISTINCT entry->>'id') FROM jsonb_array_elements(source->'items') entry) THEN RAISE EXCEPTION 'Invalid item identity'; END IF;
  SELECT COALESCE(jsonb_object_agg(entry->>'id',true),'{}'::jsonb) INTO offer_ids FROM jsonb_array_elements(source->'items') entry;
  IF cardinality(source_ids)=1 THEN base_ids:=offer_ids;base_count:=jsonb_array_length(source->'items'); END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(source->'items') LOOP
   FOREACH key IN ARRAY ARRAY['code','description','unit','group'] LOOP
    IF jsonb_typeof(item->key) IS DISTINCT FROM 'string' OR length(item->>key)>4000 THEN RAISE EXCEPTION 'Invalid item text'; END IF;
   END LOOP;
   FOREACH key IN ARRAY ARRAY['quantity','unitPrice','total'] LOOP
    IF NOT item ? key OR (item->key <> 'null'::jsonb AND (jsonb_typeof(item->key) IS DISTINCT FROM 'string' OR item->>key !~ '^-?[0-9]{1,24}(\.[0-9]{1,18})?$')) THEN RAISE EXCEPTION 'Invalid item number'; END IF;
   END LOOP;
   IF item ? 'note' AND (jsonb_typeof(item->'note') IS DISTINCT FROM 'string' OR length(item->>'note')>4000) THEN RAISE EXCEPTION 'Invalid item note'; END IF;
   IF jsonb_typeof(item->'source'->'sheet') IS DISTINCT FROM 'string' OR length(item->'source'->>'sheet')>255
    OR jsonb_typeof(item->'source'->'row') IS DISTINCT FROM 'number' OR COALESCE(item->'source'->>'row','') !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'Invalid item reference'; END IF;
  END LOOP;
  IF cardinality(source_ids)>1 THEN
   links:=document_input->'assignments'->(source->>'id');
   IF jsonb_typeof(links) IS DISTINCT FROM 'array' OR jsonb_array_length(links)>base_count THEN RAISE EXCEPTION 'Invalid assignments'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(links) entry GROUP BY entry->>'baseId' HAVING count(*)>1) THEN RAISE EXCEPTION 'Invalid inquiry assignment'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(links) entry WHERE entry->>'offerId' IS NOT NULL GROUP BY entry->>'offerId' HAVING count(*)>1) THEN RAISE EXCEPTION 'Invalid offer assignment'; END IF;
   FOR link IN SELECT value FROM jsonb_array_elements(links) LOOP
    IF jsonb_typeof(link) IS DISTINCT FROM 'object' OR jsonb_typeof(link->'baseId') IS DISTINCT FROM 'string'
     OR NOT link ? 'offerId' OR jsonb_typeof(link->'offerId') NOT IN ('string','null')
     OR jsonb_typeof(link->'status') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid assignment shape'; END IF;
    FOREACH key IN ARRAY ARRAY['candidates','reasons'] LOOP
     IF link ? key THEN
      IF jsonb_typeof(link->key) IS DISTINCT FROM 'array' OR jsonb_array_length(link->key)>30 THEN RAISE EXCEPTION 'Invalid assignment metadata'; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(link->key) entry WHERE jsonb_typeof(entry) IS DISTINCT FROM 'string' OR length(entry#>>'{}')>CASE WHEN key='candidates' THEN 200 ELSE 500 END OR (key='candidates' AND NOT (offer_ids ? (entry#>>'{}')))) THEN RAISE EXCEPTION 'Invalid assignment metadata'; END IF;
     END IF;
    END LOOP;
    IF link->>'baseId' IS NULL OR NOT (base_ids ? (link->>'baseId'))
     OR COALESCE(link->>'status','') NOT IN ('matched','manual','review','unmatched') THEN RAISE EXCEPTION 'Invalid inquiry assignment'; END IF;
    IF link->>'offerId' IS NOT NULL THEN
     IF NOT (offer_ids ? (link->>'offerId')) OR link->>'status' NOT IN ('matched','manual') THEN RAISE EXCEPTION 'Invalid offer assignment'; END IF;
    ELSIF link->>'status' IN ('matched','manual') THEN RAISE EXCEPTION 'Confirmed assignment requires offer item'; END IF;
   END LOOP;
  END IF;
  IF source->>'origin'='budget' THEN
   IF private.budget_access(project_input,'read') IS NOT TRUE THEN RAISE EXCEPTION 'Budget read denied' USING ERRCODE='42501'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.construction_budget_revisions r WHERE r.id::text=source->>'revisionId' AND r.project_id=project_input AND r.version::text=source->>'revisionVersion' AND r.deleted_at IS NULL) THEN RAISE EXCEPTION 'Budget revision changed or unavailable' USING ERRCODE='40001'; END IF;
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(document_input->'assignments') k WHERE NOT k=ANY(source_ids[2:cardinality(source_ids)])) THEN RAISE EXCEPTION 'Unknown assignment source'; END IF;
 IF category_input IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.demand_categories WHERE id::text=category_input AND project_id=project_input) THEN RAISE EXCEPTION 'Invalid tender'; END IF;
 IF id_input IS NULL THEN
  INSERT INTO public.offer_comparison_views(project_id,organization_id,category_id,title,document,request_id,created_by)
  VALUES(project_input,org,category_input,title_input,document_input,request_input,auth.uid())
  ON CONFLICT(project_id,request_id) DO NOTHING RETURNING * INTO result;
  IF result.id IS NULL THEN
   SELECT * INTO result FROM public.offer_comparison_views WHERE project_id=project_input AND request_id=request_input;
   IF result.document IS DISTINCT FROM document_input OR result.title IS DISTINCT FROM title_input OR result.category_id IS DISTINCT FROM category_input THEN RAISE EXCEPTION 'Request already used for another comparison' USING ERRCODE='40001'; END IF;
  END IF;
 ELSE
  UPDATE public.offer_comparison_views SET title=title_input,category_id=category_input,document=document_input,version=version+1,updated_at=now()
  WHERE id=id_input AND project_id=project_input AND version=version_input AND private.offer_comparison_document_access(project_input,document) IS TRUE RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Comparison changed; reload before saving' USING ERRCODE='40001'; END IF;
 END IF;
 RETURN to_jsonb(result);
END $$;
CREATE FUNCTION public.offer_comparison_save(project_input text,id_input uuid,version_input integer,request_input uuid,title_input text,category_input text,document_input jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.offer_comparison_save(project_input,id_input,version_input,request_input,title_input,category_input,document_input) $$;
REVOKE ALL ON FUNCTION private.offer_comparison_load(text,uuid),public.offer_comparison_load(text,uuid),private.offer_comparison_save(text,uuid,integer,uuid,text,text,jsonb),public.offer_comparison_save(text,uuid,integer,uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated,tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION private.offer_comparison_load(text,uuid),public.offer_comparison_load(text,uuid),private.offer_comparison_save(text,uuid,integer,uuid,text,text,jsonb),public.offer_comparison_save(text,uuid,integer,uuid,text,text,jsonb) TO authenticated,tenderflow_mcp_client;
CREATE FUNCTION private.offer_comparison_delete(project_input text,id_input uuid,version_input integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF private.offer_comparison_access(project_input,true) IS NOT TRUE THEN RAISE EXCEPTION 'Comparison delete denied' USING ERRCODE='42501'; END IF;
 DELETE FROM public.offer_comparison_views WHERE id=id_input AND project_id=project_input AND version=version_input AND private.offer_comparison_document_access(project_input,document) IS TRUE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Comparison changed or unavailable; reload before deleting' USING ERRCODE='40001'; END IF;
END $$;
CREATE FUNCTION public.offer_comparison_delete(project_input text,id_input uuid,version_input integer) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.offer_comparison_delete(project_input,id_input,version_input) $$;
REVOKE ALL ON FUNCTION private.offer_comparison_delete(text,uuid,integer),public.offer_comparison_delete(text,uuid,integer) FROM PUBLIC,anon,tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION private.offer_comparison_delete(text,uuid,integer),public.offer_comparison_delete(text,uuid,integer) TO authenticated;
COMMIT;
