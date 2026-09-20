BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
DO $migration$
DECLARE definition text; anchor text:='IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=source.created_by)';
BEGIN
 SELECT pg_get_functiondef('private.budget_backup_restore_projects(jsonb,uuid,text)'::regprocedure) INTO definition;
 IF position(anchor IN definition)=0 OR position('revision := jsonb_populate_record' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected source restore definition'; END IF;
 definition:=replace(definition,'DECLARE envelope jsonb;', 'DECLARE source_mapping jsonb:=''{}''; existing_source public.construction_budget_sources; original_source_id uuid; envelope jsonb;');
 definition:=replace(definition,anchor,$patch$
     original_source_id:=source.id;
     SELECT * INTO existing_source FROM public.construction_budget_sources s
       WHERE s.project_id=pid AND s.organization_id=org_id AND s.sha256=source.sha256 FOR UPDATE;
     IF FOUND THEN
       IF existing_source.purge_job_id IS NOT NULL OR (existing_source.id<>original_source_id AND existing_source.deleted_at IS NOT NULL)
       THEN RAISE EXCEPTION 'Shodný zdroj je v koši nebo se maže. Nejprve dokončete jeho obnovu nebo mazání.'; END IF;
       source.id:=existing_source.id;
       source.storage_path:=existing_source.storage_path;
     END IF;
     source_mapping:=source_mapping||jsonb_build_object(original_source_id::text,source.id::text);
     IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=source.created_by)$patch$);
 definition:=replace(definition,'revision := jsonb_populate_record(NULL::public.construction_budget_revisions,item);',
   'revision := jsonb_populate_record(NULL::public.construction_budget_revisions,item); revision.source_id:=COALESCE((source_mapping->>revision.source_id::text)::uuid,revision.source_id);');
 EXECUTE definition;
END $migration$;
-- Return the actual identities to the client so source bytes follow the reconciled
-- database reference. Called only after the signed restore has completed.
CREATE FUNCTION private.budget_backup_restored_sources(manifest jsonb,org_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(jsonb_object_agg(item->>'id',s.id::text),'{}'::jsonb)
 FROM jsonb_array_elements(COALESCE(manifest->'construction_budgets','[]'::jsonb)) envelope
 CROSS JOIN LATERAL jsonb_array_elements(((envelope->>'payload')::jsonb)->'sources') item
 JOIN public.construction_budget_sources s ON s.project_id=item->>'project_id'
   AND s.organization_id=org_id AND s.sha256=item->>'sha256'
$$;
REVOKE ALL ON FUNCTION private.budget_backup_restored_sources(jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
DO $migration$
DECLARE scope text; definition text; anchor text;
BEGIN
 FOREACH scope IN ARRAY ARRAY['user','tenant'] LOOP
   SELECT pg_get_functiondef(format('public.restore_%s_backup(jsonb,uuid)',scope)::regprocedure) INTO definition;
   anchor:=format('RETURN result || jsonb_build_object(''restored_construction_budget_revisions'',private.budget_backup_restore(backup_json,target_org_id,%L));',scope);
   IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Unexpected public restore return'; END IF;
   definition:=replace(definition,anchor,format('result := result || jsonb_build_object(''restored_construction_budget_revisions'',private.budget_backup_restore(backup_json,target_org_id,%L)); RETURN result || jsonb_build_object(''restored_construction_budget_sources'',private.budget_backup_restored_sources(backup_json,target_org_id));',scope));
   EXECUTE definition;
 END LOOP;
END $migration$;
COMMIT;
