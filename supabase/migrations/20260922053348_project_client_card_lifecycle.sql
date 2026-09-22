BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE INDEX project_client_cards_updated_by_idx ON public.project_client_cards(updated_by);
-- A private, transaction-bound capability permits only missing-card INSERTs during
-- authorized backup restoration. Clients cannot mint it with a custom GUC.
CREATE TABLE private.project_client_card_restore_context (
  transaction_id bigint NOT NULL,
  project_id varchar(36) NOT NULL,
  PRIMARY KEY (transaction_id, project_id)
);
ALTER TABLE private.project_client_card_restore_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.project_client_card_restore_context FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client;

CREATE FUNCTION private.guard_project_client_card_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid text;
BEGIN
  -- FK ON DELETE SET NULL must work even on an archived project. Only clearing
  -- attribution to an actually deleted user is exempt; card content is unchanged.
  IF TG_OP = 'UPDATE' AND OLD.updated_by IS NOT NULL AND NEW.updated_by IS NULL
    AND to_jsonb(NEW) - 'updated_by' = to_jsonb(OLD) - 'updated_by'
    AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.updated_by)
  THEN RETURN NEW; END IF;
  pid := CASE WHEN TG_OP = 'DELETE' THEN OLD.project_id ELSE NEW.project_id END;
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = pid AND status = 'archived') THEN
    IF TG_OP = 'INSERT' AND EXISTS (
      SELECT 1 FROM private.project_client_card_restore_context
      WHERE transaction_id = txid_current() AND project_id = pid
    ) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Project is archived';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION private.guard_project_client_card_lifecycle() FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client;
DROP TRIGGER trg_archived_guard_project_client_cards ON public.project_client_cards;
CREATE TRIGGER trg_archived_guard_project_client_cards
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_client_cards
  FOR EACH ROW EXECUTE FUNCTION private.guard_project_client_card_lifecycle();

-- Do not turn the nested FK cleanup into an edit attributed to the deleting actor.
-- The lifecycle trigger above verifies the deleted user and unchanged row first.
DO $migration$
DECLARE definition text; anchor text := '  IF TG_OP = ''UPDATE'' AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN';
BEGIN
  SELECT pg_get_functiondef('public.guard_project_client_card()'::regprocedure) INTO definition;
  IF position(anchor IN definition) = 0 THEN RAISE EXCEPTION 'Unexpected client card guard'; END IF;
  EXECUTE replace(definition, anchor, $patch$
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1
    AND OLD.updated_by IS NOT NULL AND NEW.updated_by IS NULL
    AND to_jsonb(NEW) - 'updated_by' = to_jsonb(OLD) - 'updated_by'
  THEN RETURN NEW; END IF;
$patch$ || anchor);
END $migration$;

CREATE FUNCTION private.client_card_backup_export(manifest jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cards jsonb; org_id uuid := (manifest->>'organization_id')::uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_org_member(org_id)
    OR NOT public.has_active_subscription() OR NOT public.has_resource_subscription(org_id)
    OR manifest->>'type' IS NULL OR manifest->>'type' NOT IN ('user','tenant')
    OR (manifest->>'type' = 'tenant' AND NOT public.is_org_admin(org_id))
  THEN RAISE EXCEPTION 'Client card export denied' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.project_id), '[]'::jsonb) INTO cards
  FROM public.project_client_cards c JOIN public.projects p ON p.id = c.project_id
  WHERE c.organization_id = org_id AND p.organization_id = org_id
    AND (manifest->>'type' = 'tenant' OR p.owner_id = auth.uid())
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(manifest->'projects') item WHERE item->>'id' = c.project_id);
  -- Never silently produce an incomplete backup when module access is missing.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(cards) c
    WHERE NOT public.can_project_module_action(c->>'project_id','module_projects',false))
  THEN RAISE EXCEPTION 'Client card read denied' USING ERRCODE = '42501'; END IF;
  RETURN manifest || jsonb_build_object('project_client_cards', cards);
END $$;

CREATE FUNCTION private.client_card_backup_restore(manifest jsonb, org_id uuid, scope text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item jsonb; pid text; restored integer := 0; inserted integer;
BEGIN
  IF NOT manifest ? 'project_client_cards' THEN RETURN 0; END IF;
  IF auth.uid() IS NULL OR scope IS NULL OR scope NOT IN ('user','tenant')
    OR NOT public.is_org_member(org_id) OR (scope = 'tenant' AND NOT public.is_org_admin(org_id))
    OR NOT public.has_active_subscription() OR NOT public.has_resource_subscription(org_id)
    OR (manifest->>'organization_id')::uuid IS DISTINCT FROM org_id
  THEN RAISE EXCEPTION 'Client card restore denied' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(manifest->'project_client_cards') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid client card backup';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(manifest->'project_client_cards') LOOP
    pid := item->>'project_id';
    IF (item->>'organization_id')::uuid IS DISTINCT FROM org_id
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(manifest->'projects') p WHERE p->>'id' = pid)
    THEN RAISE EXCEPTION 'Foreign client card backup' USING ERRCODE = '42501'; END IF;
    PERFORM 1 FROM public.projects WHERE id = pid AND organization_id = org_id
      AND (scope = 'tenant' OR owner_id = auth.uid()) FOR UPDATE;
    IF NOT FOUND OR NOT public.has_project_subscription(pid)
      OR NOT public.project_has_feature(pid,'module_projects')
      OR NOT (public.can_project_module_action(pid,'module_projects',true) OR public.can_project_action(pid,'restore'))
    THEN RAISE EXCEPTION 'Project is outside client card restore scope' USING ERRCODE = '42501'; END IF;
    -- Current cards win on replay and when restoring an older backup.
    IF EXISTS (SELECT 1 FROM public.project_client_cards WHERE project_id = pid) THEN CONTINUE; END IF;
    INSERT INTO private.project_client_card_restore_context VALUES (txid_current(), pid);
    INSERT INTO public.project_client_cards (
      project_id, organization_id, company_name, ico, street, zip, city,
      contact_name, contact_email, contact_phone, internal_note, created_at
    ) VALUES (
      pid, org_id, item->>'company_name', item->>'ico', item->>'street', item->>'zip', item->>'city',
      item->>'contact_name', item->>'contact_email', item->>'contact_phone', item->>'internal_note',
      COALESCE((item->>'created_at')::timestamptz, now())
    ) ON CONFLICT (project_id) DO NOTHING;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    restored := restored + inserted;
    DELETE FROM private.project_client_card_restore_context WHERE transaction_id = txid_current() AND project_id = pid;
  END LOOP;
  RETURN restored;
END $$;
REVOKE ALL ON FUNCTION private.client_card_backup_export(jsonb), private.client_card_backup_restore(jsonb,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role, tenderflow_mcp_client;

-- Extend the established authorized entry points without replacing their checks,
-- budget/file handling or historical backup formats. Include cards before the
-- original exporter records the exact manifest size and record counts.
DO $migration$
DECLARE scope text; definition text; anchor text;
BEGIN
  FOREACH scope IN ARRAY ARRAY['user','tenant'] LOOP
    SELECT pg_get_functiondef(format('public.export_%s_backup_before_shared_tenders(uuid)',scope)::regprocedure) INTO definition;
    anchor := 'rec_counts := jsonb_build_object(';
    IF position(anchor IN definition) = 0 THEN RAISE EXCEPTION 'Unexpected backup exporter'; END IF;
    EXECUTE replace(definition,anchor,
      'result := private.client_card_backup_export(result); rec_counts := jsonb_build_object(''project_client_cards'',jsonb_array_length(result->''project_client_cards''),');
    SELECT pg_get_functiondef(format('public.restore_%s_backup(jsonb,uuid)',scope)::regprocedure) INTO definition;
    anchor := 'RETURN result || jsonb_build_object(''restored_construction_budget_sources''';
    IF position(anchor IN definition) = 0 THEN RAISE EXCEPTION 'Unexpected backup restorer'; END IF;
    EXECUTE replace(definition,anchor,format(
      'result := result || jsonb_build_object(''restored_project_client_cards'',private.client_card_backup_restore(backup_json,target_org_id,%L)); ',scope) || anchor);
  END LOOP;
END $migration$;

DO $migration$
DECLARE definition text; anchor text := '  RETURN QUERY SELECT v_new_project_id;';
BEGIN
  SELECT pg_get_functiondef('public.clone_tender_project_to_realization(character varying)'::regprocedure) INTO definition;
  IF position(anchor IN definition) = 0 THEN RAISE EXCEPTION 'Unexpected project clone function'; END IF;
  EXECUTE replace(definition,anchor,$patch$
  IF EXISTS (SELECT 1 FROM public.project_client_cards WHERE project_id = v_source_project.id) THEN
    IF NOT public.can_project_module_action(v_source_project.id::text,'module_projects',false)
      OR (v_source_project.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.project_shares WHERE project_id = v_source_project.id AND user_id = auth.uid()
      )) IS NOT TRUE
    THEN RAISE EXCEPTION 'Client card clone denied' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.project_client_cards (
      project_id,organization_id,company_name,ico,street,zip,city,contact_name,contact_email,contact_phone,internal_note
    ) SELECT v_new_project_id,organization_id,company_name,ico,street,zip,city,contact_name,contact_email,contact_phone,internal_note
      FROM public.project_client_cards WHERE project_id = v_source_project.id;
  END IF;
$patch$ || anchor);
END $migration$;
NOTIFY pgrst, 'reload schema';
COMMIT;
