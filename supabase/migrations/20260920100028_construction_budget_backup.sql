BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
CREATE TABLE private.construction_budget_restore_files (
 source_id uuid PRIMARY KEY REFERENCES public.construction_budget_sources(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id)
);
ALTER TABLE private.construction_budget_restore_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.construction_budget_restore_files FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX construction_budget_restore_files_actor_idx ON private.construction_budget_restore_files(actor_id);
CREATE FUNCTION private.budget_restore_file_allowed(source_input uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.construction_budget_restore_files f
 JOIN public.construction_budget_sources s ON s.id=f.source_id
 WHERE f.source_id=source_input AND f.actor_id=auth.uid() AND s.purge_job_id IS NULL
 AND private.budget_access(s.project_id,'edit') AND private.budget_access(s.project_id,'prices'))
$$;
REVOKE ALL ON FUNCTION private.budget_restore_file_allowed(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.budget_restore_file_allowed(uuid) TO authenticated;
CREATE POLICY construction_budget_restored_files_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='construction-budgets' AND EXISTS(SELECT 1 FROM public.construction_budget_sources s WHERE s.storage_path=name AND private.budget_restore_file_allowed(s.id)));
-- Keep the signed payload as text through JSON/JavaScript round trips. This preserves
-- decimal spelling and makes historical confirmation/audit impossible to forge.
CREATE FUNCTION private.budget_backup_signature(payload text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT encode(extensions.hmac(convert_to('construction-budget-v1:'||payload,'UTF8'),secret,'sha256'),'hex')
 FROM private.retention_backup_signing_key WHERE singleton
$$;
CREATE FUNCTION private.budget_backup_export(manifest jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE project jsonb; snapshot jsonb; payload text; snapshots jsonb := '[]';
BEGIN
 FOR project IN SELECT value FROM jsonb_array_elements(manifest->'projects') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.construction_budget_sources WHERE project_id=project->>'id') THEN CONTINUE; END IF;
   IF NOT private.budget_access(project->>'id','read') OR NOT private.budget_access(project->>'id','prices')
   THEN RAISE EXCEPTION 'Úplná záloha vyžaduje oprávnění číst rozpočet včetně cen.' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT 1 FROM private.construction_budget_purge_jobs WHERE project_id=project->>'id' AND completed_at IS NULL)
   THEN RAISE EXCEPTION 'Před zálohováním dokončete rozpracované mazání rozpočtu.'; END IF;
   SELECT jsonb_build_object('version',1,'project_id',project->>'id','organization_id',manifest->>'organization_id',
     'sources',COALESCE((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('file_present',EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='construction-budgets' AND o.name=s.storage_path)) ORDER BY s.id) FROM public.construction_budget_sources s WHERE s.project_id=project->>'id'),'[]'),
     'revisions',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.construction_budget_revisions r WHERE r.project_id=project->>'id'),'[]'),
     'history',COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM public.construction_budget_history h WHERE h.project_id=project->>'id'),'[]'),
     'catalog',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.construction_budget_catalog c WHERE c.organization_id=(manifest->>'organization_id')::uuid),'[]'),
     'primary_revision_id',(SELECT revision_id FROM private.construction_budget_preferences WHERE project_id=project->>'id')) INTO snapshot;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot->'sources') s WHERE s->>'status'='ready' AND NOT (s->>'file_present')::boolean)
   THEN RAISE EXCEPTION 'Zdrojový soubor rozpočtu chybí. Záloha nebyla dokončena.'; END IF;
   payload := snapshot::text;
   snapshots := snapshots || jsonb_build_array(jsonb_build_object('payload',payload,'signature',private.budget_backup_signature(payload)));
 END LOOP;
 RETURN manifest || jsonb_build_object('construction_budgets',snapshots);
END $$;

CREATE FUNCTION private.budget_backup_restore(manifest jsonb,org_id uuid,scope text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE envelope jsonb; snapshot jsonb; item jsonb; pid text; source public.construction_budget_sources;
 revision public.construction_budget_revisions; catalog public.construction_budget_catalog;
 restored integer:=0; inserted_revisions uuid[]:='{}'; primary_id uuid;
BEGIN
 IF NOT manifest ? 'construction_budgets' THEN RETURN 0; END IF;
 IF auth.uid() IS NULL OR scope NOT IN ('user','tenant') OR scope IS NULL
   OR (scope='tenant' AND NOT public.is_org_admin(org_id)) OR NOT public.is_org_member(org_id)
   OR NOT public.has_resource_subscription(org_id) THEN RAISE EXCEPTION 'Budget restore denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(manifest->'construction_budgets') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid budget backup'; END IF;
 FOR envelope IN SELECT value FROM jsonb_array_elements(manifest->'construction_budgets') LOOP
   IF envelope->>'payload' IS NULL OR envelope->>'signature' IS NULL
      OR private.budget_backup_signature(envelope->>'payload') IS DISTINCT FROM envelope->>'signature'
   THEN RAISE EXCEPTION 'Invalid budget backup signature' USING ERRCODE='42501'; END IF;
   snapshot := (envelope->>'payload')::jsonb; pid := snapshot->>'project_id';
   IF snapshot->>'version' IS DISTINCT FROM '1' OR (snapshot->>'organization_id')::uuid IS DISTINCT FROM org_id
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(manifest->'projects') p WHERE p->>'id'=pid)
   THEN RAISE EXCEPTION 'Foreign budget backup' USING ERRCODE='42501'; END IF;
   PERFORM 1 FROM public.projects WHERE id=pid AND organization_id=org_id AND (scope='tenant' OR owner_id=auth.uid()) FOR UPDATE;
   IF NOT FOUND OR NOT private.budget_access(pid,'edit') OR NOT private.budget_access(pid,'prices')
   THEN RAISE EXCEPTION 'Project is outside budget restore scope' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT 1 FROM private.construction_budget_purge_jobs WHERE project_id=pid AND completed_at IS NULL)
   THEN RAISE EXCEPTION 'Complete budget deletion before restore'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(snapshot->'catalog') LOOP
     catalog := jsonb_populate_record(NULL::public.construction_budget_catalog,item);
     IF catalog.organization_id IS DISTINCT FROM org_id THEN RAISE EXCEPTION 'Foreign budget catalog'; END IF;
     IF EXISTS(SELECT 1 FROM public.construction_budget_catalog WHERE id=catalog.id AND organization_id<>org_id) THEN RAISE EXCEPTION 'Foreign catalog ID'; END IF;
     INSERT INTO public.construction_budget_catalog SELECT catalog.* ON CONFLICT(id) DO NOTHING;
   END LOOP;
   FOR item IN SELECT value FROM jsonb_array_elements(snapshot->'sources') LOOP
     source := jsonb_populate_record(NULL::public.construction_budget_sources,item);
     IF source.project_id IS DISTINCT FROM pid OR source.organization_id IS DISTINCT FROM org_id OR source.purge_job_id IS NOT NULL
       OR source.storage_path IS DISTINCT FROM org_id::text||'/'||source.id::text||'/source.xlsx'
     THEN RAISE EXCEPTION 'Invalid restored budget source'; END IF;
     IF EXISTS(SELECT 1 FROM public.construction_budget_sources s WHERE s.id=source.id AND (s.project_id,s.organization_id,s.sha256,s.storage_path) IS DISTINCT FROM (pid,org_id,source.sha256,source.storage_path))
     THEN RAISE EXCEPTION 'Conflicting budget source'; END IF;
     IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=source.created_by) THEN source.created_by:=auth.uid(); END IF;
     INSERT INTO public.construction_budget_sources SELECT source.* ON CONFLICT(id) DO NOTHING;
     IF COALESCE((item->>'file_present')::boolean,false) THEN
       INSERT INTO private.construction_budget_restore_files(source_id,actor_id) VALUES(source.id,auth.uid())
       ON CONFLICT(source_id) DO UPDATE SET actor_id=EXCLUDED.actor_id;
     END IF;
   END LOOP;
   inserted_revisions := '{}';
   FOR item IN SELECT value FROM jsonb_array_elements(snapshot->'revisions') LOOP
     revision := jsonb_populate_record(NULL::public.construction_budget_revisions,item);
     IF revision.project_id IS DISTINCT FROM pid OR revision.organization_id IS DISTINCT FROM org_id OR revision.purge_job_id IS NOT NULL
     THEN RAISE EXCEPTION 'Invalid restored budget revision'; END IF;
     IF EXISTS(SELECT 1 FROM public.construction_budget_revisions r WHERE r.id=revision.id AND (r.project_id,r.organization_id,r.source_id) IS DISTINCT FROM (pid,org_id,revision.source_id))
     THEN RAISE EXCEPTION 'Conflicting budget revision'; END IF;
     -- Current revisions and their audit remain authoritative; restoration fills missing IDs.
     IF EXISTS(SELECT 1 FROM public.construction_budget_revisions WHERE id=revision.id) THEN CONTINUE; END IF;
     IF (revision.status='confirmed' AND NOT private.budget_access(pid,'confirm'))
       OR (jsonb_array_length(revision.allocations)>0 AND NOT private.budget_access(pid,'allocate'))
     THEN RAISE EXCEPTION 'Budget confirmation or allocation restore denied' USING ERRCODE='42501'; END IF;
     IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=revision.created_by) THEN revision.created_by:=auth.uid(); END IF;
     INSERT INTO public.construction_budget_revisions SELECT revision.*;
     inserted_revisions := array_append(inserted_revisions,revision.id); restored:=restored+1;
   END LOOP;
   FOR item IN SELECT value FROM jsonb_array_elements(snapshot->'history') LOOP
     IF (item->>'revision_id')::uuid=ANY(inserted_revisions) THEN
       IF item->>'project_id' IS DISTINCT FROM pid THEN RAISE EXCEPTION 'Foreign history'; END IF;
       INSERT INTO public.construction_budget_history(revision_id,project_id,actor_id,created_at,event,previous_version,new_version,previous_document,previous_allocations)
       VALUES((item->>'revision_id')::uuid,pid,COALESCE((SELECT id FROM auth.users WHERE id=(item->>'actor_id')::uuid),auth.uid()),(item->>'created_at')::timestamptz,item->>'event',(item->>'previous_version')::integer,(item->>'new_version')::integer,item->'previous_document',item->'previous_allocations');
     END IF;
   END LOOP;
   primary_id:=(snapshot->>'primary_revision_id')::uuid;
   IF primary_id=ANY(inserted_revisions) THEN
     INSERT INTO private.construction_budget_preferences(project_id,revision_id) VALUES(pid,primary_id)
     ON CONFLICT(project_id) DO UPDATE SET revision_id=EXCLUDED.revision_id
       WHERE construction_budget_preferences.revision_id IS NULL OR construction_budget_preferences.revision_id=ANY(inserted_revisions);
   END IF;
 END LOOP;
 RETURN restored;
END $$;
REVOKE ALL ON FUNCTION private.budget_backup_signature(text),private.budget_backup_export(jsonb),private.budget_backup_restore(jsonb,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE scope text; definition text;
BEGIN
 FOREACH scope IN ARRAY ARRAY['user','tenant'] LOOP
   SELECT pg_get_functiondef(format('public.export_%s_backup_before_shared_tenders(uuid)',scope)::regprocedure) INTO definition;
   IF position('rec_counts := jsonb_build_object(' IN definition)=0 THEN RAISE EXCEPTION 'Unknown exporter shape'; END IF;
   definition:=replace(definition,'rec_counts := jsonb_build_object(',
     'result := private.budget_backup_export(result); rec_counts := jsonb_build_object(''construction_budgets'',jsonb_array_length(result->''construction_budgets''),');
   EXECUTE definition;
   SELECT pg_get_functiondef(format('public.restore_%s_backup(jsonb,uuid)',scope)::regprocedure) INTO definition;
   IF position('RETURN result;' IN definition)=0 THEN RAISE EXCEPTION 'Unknown restorer shape'; END IF;
   definition:=replace(definition,'RETURN result;',format('RETURN result || jsonb_build_object(''restored_construction_budget_revisions'',private.budget_backup_restore(backup_json,target_org_id,%L));',scope));
   EXECUTE definition;
 END LOOP;
END $migration$;
DO $migration$
DECLARE scope text;
BEGIN
 FOREACH scope IN ARRAY ARRAY['user','tenant'] LOOP
   EXECUTE format($fn$
     CREATE FUNCTION public.export_%1$s_backup(target_org_id uuid,include_budget_files boolean) RETURNS jsonb
     LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
     DECLARE result jsonb;
     BEGIN
       IF NOT public.has_resource_subscription(target_org_id) THEN RAISE EXCEPTION 'Active organization subscription required' USING ERRCODE='PT402'; END IF;
       result:=public.export_%1$s_backup_before_shared_tenders(target_org_id);
       IF NOT COALESCE(include_budget_files,false) AND jsonb_array_length(result->'construction_budgets')>0 THEN
         RAISE EXCEPTION 'Záloha obsahuje rozpočty. Aktualizujte aplikaci pro úplnou zálohu včetně XLSX.';
       END IF;
       RETURN result;
     END $body$;
   $fn$,scope);
   EXECUTE format('CREATE OR REPLACE FUNCTION public.export_%1$s_backup(target_org_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='''' AS $body$ SELECT public.export_%1$s_backup(target_org_id,false) $body$',scope);
   EXECUTE format('REVOKE ALL ON FUNCTION public.export_%s_backup(uuid,boolean) FROM PUBLIC,anon',scope);
   EXECUTE format('GRANT EXECUTE ON FUNCTION public.export_%s_backup(uuid,boolean) TO authenticated,service_role',scope);
 END LOOP;
END $migration$;
COMMIT;
