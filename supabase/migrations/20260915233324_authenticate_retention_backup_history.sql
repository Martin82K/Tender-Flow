BEGIN;
-- The signing key never leaves the database and is not readable by API roles.
CREATE TABLE private.retention_backup_signing_key (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  secret bytea NOT NULL DEFAULT extensions.gen_random_bytes(32)
);
REVOKE ALL ON private.retention_backup_signing_key FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO private.retention_backup_signing_key(singleton) VALUES(true);
CREATE FUNCTION private.retention_backup_signature(item jsonb) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  -- JSON files round-trip through JavaScript numbers (5.00 becomes 5).
  SELECT encode(extensions.hmac(convert_to((SELECT jsonb_object_agg(key,
    CASE WHEN jsonb_typeof(value)='number' THEN to_jsonb(trim_scale(value::text::numeric)) ELSE value END) FROM jsonb_each(item)
    WHERE key IN ('id','project_id','organization_id','owner_id','contract_retention_events',
      'retention_short_percent','retention_short_amount','retention_short_status','retention_short_release_on','retention_short_expected_on',
      'retention_long_percent','retention_long_amount','retention_long_status','retention_long_release_on','retention_long_expected_on'))::text,'UTF8'),secret,'sha256'),'hex')
  FROM private.retention_backup_signing_key WHERE singleton
$$;
REVOKE ALL ON FUNCTION private.retention_backup_signature(jsonb) FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE definition text; scope text;
BEGIN
  FOREACH scope IN ARRAY ARRAY['user','tenant'] LOOP
    SELECT pg_get_functiondef(format('public.export_%s_backup_before_shared_tenders(uuid)',scope)::regprocedure) INTO definition;
    IF position('rec_counts := jsonb_build_object(' IN definition)=0 THEN RAISE EXCEPTION 'Unknown exporter shape'; END IF;
    definition := replace(definition,'rec_counts := jsonb_build_object(',$patch$
      result := jsonb_set(result,'{contracts}',COALESCE((SELECT jsonb_agg(item || jsonb_build_object(
        'retention_backup_signature',private.retention_backup_signature(item))) FROM jsonb_array_elements(result->'contracts') item),'[]'::jsonb));
      rec_counts := jsonb_build_object(
    $patch$);
    EXECUTE definition;
  END LOOP;

  SELECT pg_get_functiondef('private.begin_contract_retention_restore(jsonb,uuid,text)'::regprocedure) INTO definition;
  IF position('-- Preserve fields absent from legacy manifests.' IN definition)=0 THEN RAISE EXCEPTION 'Unknown restore authorization shape'; END IF;
  definition := replace(definition,'-- Preserve fields absent from legacy manifests. Only retention fields can enter the capability.',$patch$
    IF existing.id IS NOT NULL THEN
      -- Existing retention and audit are authoritative: a backup cannot rewrite either.
      -- The original restorer uses UPSERT. Seed its BEFORE INSERT from the locked DB row;
      -- its subsequent UPDATE still passes through the normal audit trigger.
      SELECT jsonb_object_agg(key,value) INTO payload FROM jsonb_each(to_jsonb(existing))
      WHERE key IN ('retention_short_percent','retention_short_amount','retention_short_status','retention_short_release_on','retention_short_expected_on',
        'retention_long_percent','retention_long_amount','retention_long_status','retention_long_release_on','retention_long_expected_on');
      INSERT INTO private.contract_retention_restore_context VALUES(txid_current(),existing.id,payload || '{"_existing":true}'::jsonb);
      RETURN;
    END IF;
    IF item ? 'retention_backup_signature' THEN
      IF private.retention_backup_signature(item) IS NULL OR item->>'retention_backup_signature' IS DISTINCT FROM private.retention_backup_signature(item) THEN
        RAISE EXCEPTION 'Backup retention signature is invalid' USING ERRCODE='42501';
      END IF;
    ELSIF item->>'retention_short_status'='released' OR item->>'retention_long_status'='released'
      OR jsonb_array_length(COALESCE(item->'contract_retention_events','[]'::jsonb)) > 0 THEN
      RAISE EXCEPTION 'Historical retention evidence requires a signed database export' USING ERRCODE='42501';
    ELSE
      -- Legacy unsigned plans are editable data, not evidence of an actual release.
      item := item || jsonb_build_object('retention_short_expected_on',item->'retention_short_release_on',
        'retention_long_expected_on',item->'retention_long_release_on');
    END IF;
    -- Preserve fields absent from legacy manifests.
  $patch$);
  EXECUTE definition;

  SELECT pg_get_functiondef('private.record_contract_retention()'::regprocedure) INTO definition;
  IF position('contract_id=NEW.id) THEN' IN definition)=0 THEN RAISE EXCEPTION 'Unknown retention trigger shape'; END IF;
  definition := replace(definition,'contract_id=NEW.id) THEN',
    'contract_id=NEW.id AND (TG_OP=''INSERT'' OR NOT (payload ? ''_existing''))) THEN');
  EXECUTE definition;

  SELECT pg_get_functiondef('private.finish_contract_retention_restore(jsonb)'::regprocedure) INTO definition;
  IF position('FOR event IN SELECT' IN definition)=0 THEN RAISE EXCEPTION 'Unknown event restorer shape'; END IF;
  definition := replace(definition,'FOR event IN SELECT',$patch$
    IF EXISTS(SELECT 1 FROM private.contract_retention_restore_context WHERE transaction_id=txid_current() AND contract_id=cid AND payload ? '_existing') THEN
      DELETE FROM private.contract_retention_restore_context WHERE transaction_id=txid_current() AND contract_id=cid;
      RETURN;
    END IF;
    FOR event IN SELECT
  $patch$);
  EXECUTE definition;
END $migration$;
COMMIT;
