BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- Keep the administrative backfill atomic, including archived contracts.
LOCK TABLE public.contracts IN ACCESS EXCLUSIVE MODE;
-- Legacy release_on remains planned while held and actual while released.
-- New clients use expected_on for the plan. Preserve old clients and never infer a lost historical plan.
ALTER TABLE public.contracts
  ADD COLUMN retention_short_expected_on date,
  ADD COLUMN retention_long_expected_on date;
ALTER TABLE public.contracts DISABLE TRIGGER trg_archived_guard_contracts;
ALTER TABLE public.contracts DISABLE TRIGGER tr_contracts_updated_at;
UPDATE public.contracts SET
  retention_short_expected_on = CASE WHEN retention_short_status IS DISTINCT FROM 'released' THEN retention_short_release_on END,
  retention_long_expected_on = CASE WHEN retention_long_status IS DISTINCT FROM 'released' THEN retention_long_release_on END;
ALTER TABLE public.contracts ENABLE TRIGGER tr_contracts_updated_at;
ALTER TABLE public.contracts ENABLE TRIGGER trg_archived_guard_contracts;
COMMENT ON COLUMN public.contracts.retention_short_expected_on IS 'Planned release date preserved across release; NULL means unknown, including historical released records.';
COMMENT ON COLUMN public.contracts.retention_long_expected_on IS 'Planned release date preserved across release; NULL means unknown, including historical released records.';

CREATE TABLE public.contract_retention_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('short','long')),
  previous_status text,
  status text,
  expected_on date,
  release_on date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX contract_retention_events_contract_idx ON public.contract_retention_events(contract_id, created_at DESC);
CREATE INDEX contract_retention_events_author_idx ON public.contract_retention_events(created_by);
ALTER TABLE public.contract_retention_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_retention_events FROM anon, authenticated;
GRANT SELECT ON public.contract_retention_events TO authenticated;
GRANT ALL ON public.contract_retention_events TO service_role;
CREATE POLICY retention_events_read ON public.contract_retention_events FOR SELECT TO authenticated
USING (public.has_active_subscription() AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND public.can_project_module_action(c.project_id::text,'module_contracts',false)));

-- Private trigger: attribution cannot be forged by the client and audit rows cannot be edited.
CREATE FUNCTION private.record_contract_retention() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE kind text; old_row jsonb; new_row jsonb; prefix text; old_status text; new_status text; planned date; actual date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    old_row := '{}'::jsonb;
  ELSE
    old_row := to_jsonb(OLD);
  END IF;
  new_row := to_jsonb(NEW);
  FOREACH kind IN ARRAY ARRAY['short','long'] LOOP
    prefix := 'retention_' || kind;
    old_status := old_row->>(prefix || '_status');
    new_status := new_row->>(prefix || '_status');
    IF TG_OP = 'UPDATE' AND (old_row->(prefix || '_status'), old_row->(prefix || '_release_on')) IS NOT DISTINCT FROM
        (new_row->(prefix || '_status'), new_row->(prefix || '_release_on')) THEN
      -- expected_on is derived, not a client-controlled override.
      new_row := jsonb_set(new_row, ARRAY[prefix || '_expected_on'], coalesce(old_row->(prefix || '_expected_on'),'null'::jsonb));
      CONTINUE;
    END IF;
    IF auth.uid() IS NOT NULL AND (NOT public.has_active_subscription() OR NOT public.can_project_module_action(NEW.project_id::text,'module_contracts',true)) THEN
      RAISE EXCEPTION 'K této smlouvě nemáte oprávnění zapisovat.' USING ERRCODE='42501';
    END IF;
    actual := (new_row->>(prefix || '_release_on'))::date;
    IF new_status = 'released' THEN
      planned := (old_row->>(prefix || '_expected_on'))::date;
      -- Legacy clients without a release date use today. Explicit dates are preserved.
      IF old_status IS DISTINCT FROM 'released' AND actual IS NULL THEN actual := current_date; END IF;
      IF actual IS NULL OR actual > current_date OR actual < DATE '1900-01-01' THEN RAISE EXCEPTION 'Neplatné datum skutečného uvolnění.'; END IF;
    ELSE
      planned := actual;
    END IF;
    new_row := jsonb_set(new_row, ARRAY[prefix || '_expected_on'], coalesce(to_jsonb(planned),'null'::jsonb));
    new_row := jsonb_set(new_row, ARRAY[prefix || '_release_on'], coalesce(to_jsonb(actual),'null'::jsonb));
    -- INSERT auditing is deferred to the AFTER trigger below (the parent row must exist).
    IF TG_OP = 'UPDATE' THEN
      INSERT INTO public.contract_retention_events(contract_id,kind,previous_status,status,expected_on,release_on,created_by)
      VALUES(NEW.id,kind,old_status,new_status,planned,CASE WHEN new_status='released' THEN actual END,auth.uid());
    END IF;
  END LOOP;
  NEW := jsonb_populate_record(NEW,new_row);
  RETURN NEW;
END; $$;
CREATE TRIGGER record_contract_retention BEFORE INSERT OR UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION private.record_contract_retention();

CREATE FUNCTION private.record_initial_contract_retention() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET timezone = 'UTC' AS $$
BEGIN
  IF NEW.retention_short_status = 'released' THEN
    INSERT INTO public.contract_retention_events(contract_id,kind,status,release_on,created_by)
    VALUES(NEW.id,'short','released',NEW.retention_short_release_on,auth.uid());
  END IF;
  IF NEW.retention_long_status = 'released' THEN
    INSERT INTO public.contract_retention_events(contract_id,kind,status,release_on,created_by)
    VALUES(NEW.id,'long','released',NEW.retention_long_release_on,auth.uid());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER record_initial_contract_retention AFTER INSERT ON public.contracts
FOR EACH ROW EXECUTE FUNCTION private.record_initial_contract_retention();
REVOKE ALL ON FUNCTION private.record_contract_retention(), private.record_initial_contract_retention() FROM PUBLIC, anon, authenticated;

-- Invoker preserves existing contracts RLS. Row lock rejects double confirmation.
CREATE FUNCTION public.release_contract_retention(contract_id_input uuid,kind_input text,date_input date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE c public.contracts;
BEGIN
  IF auth.uid() IS NULL OR kind_input IS NULL OR kind_input NOT IN ('short','long')
    OR date_input IS NULL OR date_input > current_date OR date_input < DATE '1900-01-01' THEN
    RAISE EXCEPTION 'Neplatné potvrzení uvolnění.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO c FROM public.contracts WHERE id=contract_id_input FOR UPDATE;
  IF c.id IS NULL OR NOT public.has_active_subscription() OR NOT public.can_project_module_action(c.project_id::text,'module_contracts',true) THEN
    RAISE EXCEPTION 'Smlouva neexistuje nebo nemáte oprávnění.' USING ERRCODE='42501';
  END IF;
  IF (kind_input='short' AND c.retention_short_status='released') OR (kind_input='long' AND c.retention_long_status='released') THEN
    RAISE EXCEPTION 'Pozastávka již byla uvolněna. Obnovte detail.' USING ERRCODE='40001';
  END IF;
  IF kind_input='short' THEN
    UPDATE public.contracts SET retention_short_status='released',retention_short_release_on=date_input WHERE id=c.id;
  ELSE
    UPDATE public.contracts SET retention_long_status='released',retention_long_release_on=date_input WHERE id=c.id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'K této smlouvě nemáte oprávnění zapisovat.' USING ERRCODE='42501'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.release_contract_retention(uuid,text,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_contract_retention(uuid,text,date) TO authenticated;
COMMIT;
