-- Only fresh UUID fixtures. Subtransaction rollback simulates missing records without DELETE.
BEGIN;
DO $$
DECLARE candidate record; selected boolean := false; cid uuid; manifest jsonb; original jsonb; restored jsonb; events jsonb; scope text; bad jsonb;
BEGIN
  FOR candidate IN SELECT p.id,p.owner_id,p.organization_id FROM public.projects p
    WHERE p.owner_id IS NOT NULL AND p.organization_id IS NOT NULL AND p.status <> 'archived' LOOP
    PERFORM set_config('request.jwt.claim.sub',candidate.owner_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',candidate.owner_id,'role','authenticated')::text,true);
    IF public.is_org_admin(candidate.organization_id) AND public.has_active_subscription()
      AND public.can_project_module_action(candidate.id,'module_contracts',true) THEN selected := true; EXIT; END IF;
  END LOOP;
  IF NOT selected THEN RAISE EXCEPTION 'No entitled admin-owned fixture'; END IF;
  FOREACH scope IN ARRAY ARRAY['user','tenant'] LOOP
    cid := gen_random_uuid();
    BEGIN
      INSERT INTO public.contracts(id,project_id,vendor_name,title,status,currency,base_price,source,owner_id,organization_id,retention_short_percent,retention_short_release_on,retention_long_percent,retention_long_release_on)
      VALUES(cid,candidate.id,'Rollback fixture','Retention backup test','active','CZK',1000,'manual',candidate.owner_id,candidate.organization_id,5,DATE '2026-08-01',3,DATE '2027-08-01');
      PERFORM public.release_contract_retention(cid,'short',DATE '2026-08-12');
      SELECT jsonb_build_object('short_plan',retention_short_expected_on,'short_actual',retention_short_release_on,'short_status',retention_short_status,'short_percent',retention_short_percent,'long_plan',retention_long_expected_on) INTO original FROM public.contracts WHERE id=cid;
      SELECT jsonb_agg(to_jsonb(e) ORDER BY id) INTO events FROM public.contract_retention_events e WHERE contract_id=cid;
      EXECUTE format('SELECT public.export_%s_backup($1)',scope) INTO manifest USING candidate.organization_id;
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(manifest->'contracts') c WHERE c->>'id'=cid::text AND c->'contract_retention_events'=events AND c ? 'retention_backup_signature') THEN RAISE EXCEPTION 'Signed history missing from % manifest',scope; END IF;
      manifest := jsonb_build_object('version','1.0','contracts',(SELECT jsonb_agg(c) FROM jsonb_array_elements(manifest->'contracts') c WHERE c->>'id'=cid::text));
      RAISE EXCEPTION 'Rollback fixture; retain manifest in PL/pgSQL variables' USING ERRCODE='Z0001';
    EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL; END;
    IF EXISTS(SELECT 1 FROM public.contracts WHERE id=cid) THEN RAISE EXCEPTION 'Fixture did not roll back'; END IF;
    IF private.retention_backup_signature((manifest#>'{contracts,0}') || jsonb_build_object('retention_short_percent',5.000::numeric))
      IS DISTINCT FROM manifest#>>'{contracts,0,retention_backup_signature}' THEN RAISE EXCEPTION 'JSON number normalization invalidates signature'; END IF;
    -- Edited attribution, time, state or contract identity cannot be imported.
    bad := jsonb_set(manifest,'{contracts,0,contract_retention_events,0,created_by}',to_jsonb(gen_random_uuid()));
    BEGIN
      EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING bad,candidate.organization_id;
      RAISE EXCEPTION 'Forged author accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    bad := jsonb_set(manifest,'{contracts,0,contract_retention_events,0,created_at}',to_jsonb(now()+interval '1 day'));
    BEGIN
      EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING bad,candidate.organization_id;
      RAISE EXCEPTION 'Forged time accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    bad := jsonb_set(manifest,'{contracts,0,id}',to_jsonb(gen_random_uuid()));
    BEGIN
      EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING bad,candidate.organization_id;
      RAISE EXCEPTION 'Signature replay for another contract accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    bad := jsonb_set(manifest,'{contracts,0}',(manifest#>'{contracts,0}')-'retention_backup_signature');
    BEGIN
      EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING bad,candidate.organization_id;
      RAISE EXCEPTION 'Unsigned history accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING manifest,candidate.organization_id;
    SELECT jsonb_build_object('short_plan',retention_short_expected_on,'short_actual',retention_short_release_on,'short_status',retention_short_status,'short_percent',retention_short_percent,'long_plan',retention_long_expected_on) INTO restored FROM public.contracts WHERE id=cid;
    IF restored IS DISTINCT FROM original THEN RAISE EXCEPTION 'Retention fields lost in % restore',scope; END IF;
    IF (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.contract_retention_events e WHERE contract_id=cid) IS DISTINCT FROM events THEN RAISE EXCEPTION 'History lost in % restore',scope; END IF;
    EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING manifest,candidate.organization_id;
    -- Existing evidence wins over stale or forged backup content.
    bad := jsonb_set(manifest,'{contracts,0,retention_short_status}','"held"'::jsonb);
    bad := jsonb_set(bad,'{contracts,0,contract_retention_events}','[]'::jsonb);
    EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING bad,candidate.organization_id;
    IF (SELECT retention_short_status FROM public.contracts WHERE id=cid) <> 'released'
      OR (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.contract_retention_events e WHERE contract_id=cid) IS DISTINCT FROM events THEN RAISE EXCEPTION 'Existing evidence changed'; END IF;
  END LOOP;
  cid := gen_random_uuid();
  manifest := jsonb_build_object('version','1.0','contracts',jsonb_build_array(jsonb_build_object(
    'id',cid,'project_id',candidate.id,'vendor_name','Rollback legacy fixture','title','Unsigned planned retention',
    'retention_short_status','held','retention_short_percent',5,'retention_short_release_on','2026-08-01')));
  PERFORM public.restore_user_backup(manifest,candidate.organization_id);
  IF (SELECT retention_short_expected_on FROM public.contracts WHERE id=cid) IS DISTINCT FROM DATE '2026-08-01'
    OR EXISTS(SELECT 1 FROM public.contract_retention_events WHERE contract_id=cid) THEN RAISE EXCEPTION 'Legacy plan restore changed behavior'; END IF;
  IF EXISTS(SELECT 1 FROM private.contract_retention_restore_context) THEN RAISE EXCEPTION 'Leaked restore capability'; END IF;
  IF has_table_privilege('authenticated','private.retention_backup_signing_key','SELECT')
    OR has_function_privilege('authenticated','private.retention_backup_signature(jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','private.begin_contract_retention_restore(jsonb,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Client can forge backup proof'; END IF;
END $$;
ROLLBACK;
