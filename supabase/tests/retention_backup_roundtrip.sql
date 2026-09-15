-- All writes, including export/restore history, are rolled back.
BEGIN;
DO $$
DECLARE candidate record; selected boolean := false; cid uuid := gen_random_uuid();
  manifest jsonb; original jsonb; restored jsonb; events jsonb; scope text; restored_id uuid; bad jsonb;
BEGIN
  FOR candidate IN SELECT p.id,p.owner_id,p.organization_id FROM public.projects p
    WHERE p.owner_id IS NOT NULL AND p.organization_id IS NOT NULL AND p.status <> 'archived' LOOP
    PERFORM set_config('request.jwt.claim.sub',candidate.owner_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',candidate.owner_id,'role','authenticated')::text,true);
    IF public.is_org_admin(candidate.organization_id) AND public.has_active_subscription()
      AND public.can_project_module_action(candidate.id,'module_contracts',true) THEN selected := true; EXIT; END IF;
  END LOOP;
  IF NOT selected THEN RAISE EXCEPTION 'No entitled admin-owned fixture'; END IF;
  INSERT INTO public.contracts(id,project_id,vendor_name,title,status,currency,base_price,source,owner_id,organization_id,retention_short_percent,retention_short_release_on,retention_long_percent,retention_long_release_on)
  VALUES(cid,candidate.id,'Rollback fixture','Retention backup test','active','CZK',1000,'manual',candidate.owner_id,candidate.organization_id,5,DATE '2026-08-01',3,DATE '2027-08-01');
  PERFORM public.release_contract_retention(cid,'short',DATE '2026-08-12');
  SELECT jsonb_build_object('short_plan',retention_short_expected_on,'short_actual',retention_short_release_on,'short_status',retention_short_status,'short_percent',retention_short_percent,'long_plan',retention_long_expected_on) INTO original FROM public.contracts WHERE id=cid;
  SELECT jsonb_agg(to_jsonb(e) ORDER BY id) INTO events FROM public.contract_retention_events e WHERE contract_id=cid;
  FOREACH scope IN ARRAY ARRAY['user','tenant'] LOOP
    EXECUTE format('SELECT public.export_%s_backup($1)',scope) INTO manifest USING candidate.organization_id;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(manifest->'contracts') c WHERE c->>'id'=cid::text AND c->'contract_retention_events'=events) THEN
      RAISE EXCEPTION 'Retention history missing from % manifest',scope;
    END IF;
    -- Isolate the fixture: never restore actual application records during this test.
    manifest := jsonb_build_object('version','1.0','contracts',(SELECT jsonb_agg(c) FROM jsonb_array_elements(manifest->'contracts') c WHERE c->>'id'=cid::text));
    -- Restore only into fresh UUIDs; do not delete or overwrite any existing contract.
    restored_id := gen_random_uuid();
    manifest := jsonb_set(manifest,'{contracts,0,id}',to_jsonb(restored_id));
    manifest := jsonb_set(manifest,'{contracts,0,contract_retention_events}',(
      SELECT jsonb_agg(e || jsonb_build_object('id',gen_random_uuid(),'contract_id',restored_id)) FROM jsonb_array_elements(events) e));
    EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING manifest,candidate.organization_id;
    SELECT jsonb_build_object('short_plan',retention_short_expected_on,'short_actual',retention_short_release_on,'short_status',retention_short_status,'short_percent',retention_short_percent,'long_plan',retention_long_expected_on) INTO restored FROM public.contracts WHERE id=restored_id;
    IF restored IS DISTINCT FROM original THEN RAISE EXCEPTION 'Retention fields lost in % restore: % vs %',scope,restored,original; END IF;
    IF (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.contract_retention_events e WHERE contract_id=restored_id) IS DISTINCT FROM manifest#>'{contracts,0,contract_retention_events}' THEN RAISE EXCEPTION 'Retention history lost in % restore',scope; END IF;
    EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING manifest,candidate.organization_id;
    IF (SELECT count(*) FROM public.contract_retention_events WHERE contract_id=restored_id) <> jsonb_array_length(events) THEN RAISE EXCEPTION 'Repeat restore duplicated audit'; END IF;
    bad := jsonb_set(manifest,'{contracts,0,contract_retention_events,0,contract_id}',to_jsonb(cid));
    BEGIN
      EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING bad,candidate.organization_id;
      RAISE EXCEPTION 'Foreign contract event accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    bad := jsonb_set(manifest,'{contracts,0,contract_retention_events,0,id}',events#>'{0,id}');
    BEGIN
      EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING bad,candidate.organization_id;
      RAISE EXCEPTION 'Conflicting audit ID accepted';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    bad := jsonb_set(manifest,'{contracts,0,project_id}',to_jsonb(gen_random_uuid()::text));
    BEGIN
      EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING bad,candidate.organization_id;
      RAISE EXCEPTION 'Foreign project accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    -- A pre-retention backup must not erase the existing plan or audit.
    bad := jsonb_build_object('version','1.0','contracts',jsonb_build_array((manifest#>'{contracts,0}') - ARRAY[
      'contract_retention_events','retention_short_expected_on','retention_long_expected_on',
      'retention_short_status','retention_short_release_on','retention_short_percent',
      'retention_long_status','retention_long_release_on','retention_long_percent']));
    EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING bad,candidate.organization_id;
    IF (SELECT retention_short_expected_on FROM public.contracts WHERE id=restored_id) IS DISTINCT FROM DATE '2026-08-01'
      OR (SELECT count(*) FROM public.contract_retention_events WHERE contract_id=restored_id) <> jsonb_array_length(events) THEN RAISE EXCEPTION 'Legacy backup erased evidence'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM private.contract_retention_restore_context) THEN RAISE EXCEPTION 'Leaked restore capability'; END IF;
  IF has_table_privilege('authenticated','private.contract_retention_restore_context','INSERT')
    OR has_function_privilege('authenticated','private.begin_contract_retention_restore(jsonb,uuid,text)','EXECUTE')
    OR has_function_privilege('anon','private.finish_contract_retention_restore(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Client can bypass audit'; END IF;
END $$;
ROLLBACK;
