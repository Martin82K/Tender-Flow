BEGIN;
-- A private, transaction-scoped capability. Client-set GUCs must never bypass audit triggers.
CREATE TABLE private.contract_retention_restore_context (
  transaction_id bigint NOT NULL,
  contract_id uuid NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY(transaction_id, contract_id)
);
REVOKE ALL ON private.contract_retention_restore_context FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.begin_contract_retention_restore(item jsonb, org_id uuid, scope text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing public.contracts; project public.projects; payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR scope NOT IN ('user','tenant') OR scope IS NULL
    OR (scope='tenant' AND NOT public.is_org_admin(org_id))
    OR (scope='user' AND NOT public.is_org_member(org_id)) THEN
    RAISE EXCEPTION 'Unauthorized retention restore' USING ERRCODE='42501';
  END IF;
  SELECT * INTO project FROM public.projects WHERE id=item->>'project_id' AND organization_id=org_id;
  IF project.id IS NULL OR (scope='user' AND (project.owner_id IS DISTINCT FROM auth.uid()
      AND NOT EXISTS(SELECT 1 FROM public.project_shares ps WHERE ps.project_id=project.id AND ps.user_id=auth.uid() AND ps.permission='edit'))) THEN
    RAISE EXCEPTION 'Project is outside restore scope' USING ERRCODE='42501';
  END IF;
  SELECT * INTO existing FROM public.contracts WHERE id=(item->>'id')::uuid FOR UPDATE;
  IF existing.id IS NOT NULL AND (existing.organization_id IS DISTINCT FROM org_id
      OR existing.project_id IS DISTINCT FROM project.id
      OR (scope='user' AND existing.owner_id IS DISTINCT FROM auth.uid())) THEN
    RAISE EXCEPTION 'Contract is outside restore scope' USING ERRCODE='42501';
  END IF;
  -- Preserve fields absent from legacy manifests. Only retention fields can enter the capability.
  SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb) INTO payload
  FROM jsonb_each((CASE WHEN existing.id IS NOT NULL THEN to_jsonb(existing) ELSE '{}'::jsonb END) || item)
  WHERE key IN ('retention_short_percent','retention_short_amount','retention_short_status','retention_short_release_on','retention_short_expected_on',
                'retention_long_percent','retention_long_amount','retention_long_status','retention_long_release_on','retention_long_expected_on');
  -- Old exports lack expected_on: release_on was a plan only while not released.
  IF NOT (item ? 'retention_short_expected_on') AND existing.id IS NULL THEN
    payload := payload || jsonb_build_object('retention_short_expected_on',CASE WHEN item->>'retention_short_status' IS DISTINCT FROM 'released' THEN item->'retention_short_release_on' END);
  END IF;
  IF NOT (item ? 'retention_long_expected_on') AND existing.id IS NULL THEN
    payload := payload || jsonb_build_object('retention_long_expected_on',CASE WHEN item->>'retention_long_status' IS DISTINCT FROM 'released' THEN item->'retention_long_release_on' END);
  END IF;
  INSERT INTO private.contract_retention_restore_context VALUES(txid_current(),(item->>'id')::uuid,payload);
END $$;

CREATE FUNCTION private.finish_contract_retention_restore(item jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE event jsonb; cid uuid := (item->>'id')::uuid; author uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM private.contract_retention_restore_context WHERE transaction_id=txid_current() AND contract_id=cid) THEN
    RAISE EXCEPTION 'Missing restore capability' USING ERRCODE='42501';
  END IF;
  FOR event IN SELECT jsonb_array_elements(COALESCE(item->'contract_retention_events','[]'::jsonb)) LOOP
    IF (event->>'contract_id')::uuid IS DISTINCT FROM cid THEN RAISE EXCEPTION 'Foreign retention event' USING ERRCODE='42501'; END IF;
    SELECT id INTO author FROM auth.users WHERE id=(event->>'created_by')::uuid;
    -- Existing audit is immutable, even to backup restore. Reject conflicting IDs, never overwrite.
    IF EXISTS(SELECT 1 FROM public.contract_retention_events e WHERE e.id=(event->>'id')::uuid
      AND (e.contract_id,e.kind,e.previous_status,e.status,e.expected_on,e.release_on,e.created_at,e.created_by)
        IS DISTINCT FROM (cid,event->>'kind',event->>'previous_status',event->>'status',
          (event->>'expected_on')::date,(event->>'release_on')::date,(event->>'created_at')::timestamptz,author)) THEN
      RAISE EXCEPTION 'Conflicting retention event' USING ERRCODE='23505';
    END IF;
    INSERT INTO public.contract_retention_events(id,contract_id,kind,previous_status,status,expected_on,release_on,created_at,created_by)
    VALUES((event->>'id')::uuid,cid,event->>'kind',event->>'previous_status',event->>'status',
      (event->>'expected_on')::date,(event->>'release_on')::date,(event->>'created_at')::timestamptz,author)
    ON CONFLICT(id) DO NOTHING;
  END LOOP;
  DELETE FROM private.contract_retention_restore_context WHERE transaction_id=txid_current() AND contract_id=cid;
END $$;
REVOKE ALL ON FUNCTION private.begin_contract_retention_restore(jsonb,uuid,text),private.finish_contract_retention_restore(jsonb) FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE scope text; definition text; signature regprocedure;
BEGIN
  FOREACH scope IN ARRAY ARRAY['user','tenant'] LOOP
    signature := format('public.export_%s_backup_before_shared_tenders(uuid)',scope)::regprocedure;
    SELECT pg_get_functiondef(signature) INTO definition;
    IF position('rec_counts := jsonb_build_object(' IN definition)=0 THEN RAISE EXCEPTION 'Unknown exporter shape'; END IF;
    definition := replace(definition,'rec_counts := jsonb_build_object(',$patch$
      result := jsonb_set(result,'{contracts}',COALESCE((SELECT jsonb_agg(item || jsonb_build_object('contract_retention_events',COALESCE((
        SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.contract_retention_events e WHERE e.contract_id=(item->>'id')::uuid
      ),'[]'::jsonb))) FROM jsonb_array_elements(result->'contracts') item),'[]'::jsonb));
      rec_counts := jsonb_build_object(
        'contract_retention_events',(SELECT COALESCE(sum(jsonb_array_length(item->'contract_retention_events')),0) FROM jsonb_array_elements(result->'contracts') item),
    $patch$);
    EXECUTE definition;
    signature := format('public.restore_%s_backup_without_offer_deadline_20260817(jsonb,uuid)',scope)::regprocedure;
    SELECT pg_get_functiondef(signature) INTO definition;
    IF position('INSERT INTO public.contracts (' IN definition)=0 OR position('cnt_contracts := cnt_contracts + 1;' IN definition)=0 THEN RAISE EXCEPTION 'Unknown restorer shape'; END IF;
    definition := replace(definition,'INSERT INTO public.contracts (',format('PERFORM private.begin_contract_retention_restore(item,target_org_id,%L); INSERT INTO public.contracts (',scope));
    definition := replace(definition,'cnt_contracts := cnt_contracts + 1;','PERFORM private.finish_contract_retention_restore(item); cnt_contracts := cnt_contracts + 1;');
    EXECUTE definition;
  END LOOP;
  SELECT pg_get_functiondef('private.record_contract_retention()'::regprocedure) INTO definition;
  definition := replace(definition,E'BEGIN\n',E'BEGIN\n' || $patch$
    IF EXISTS(SELECT 1 FROM private.contract_retention_restore_context WHERE transaction_id=txid_current() AND contract_id=NEW.id) THEN
      NEW := jsonb_populate_record(NEW,(SELECT payload FROM private.contract_retention_restore_context WHERE transaction_id=txid_current() AND contract_id=NEW.id));
      RETURN NEW;
    END IF;
  $patch$);
  EXECUTE definition;
  SELECT pg_get_functiondef('private.record_initial_contract_retention()'::regprocedure) INTO definition;
  definition := replace(definition,E'BEGIN\n',E'BEGIN\n' || $patch$
    IF EXISTS(SELECT 1 FROM private.contract_retention_restore_context WHERE transaction_id=txid_current() AND contract_id=NEW.id) THEN RETURN NEW; END IF;
  $patch$);
  EXECUTE definition;
END $migration$;
COMMIT;
