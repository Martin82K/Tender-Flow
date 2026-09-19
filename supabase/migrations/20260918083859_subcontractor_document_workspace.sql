-- Reuse immutable document versions. Existing work protocols require no backfill.
ALTER TABLE public.contract_handover_events DROP CONSTRAINT contract_handover_events_kind_check;
ALTER TABLE public.contract_handover_events ADD CONSTRAINT contract_handover_events_kind_check CHECK (kind IN ('handover','site_handover','warranty'));
ALTER TABLE public.contract_handover_events ADD COLUMN document_version_id uuid REFERENCES public.contract_generated_documents(id) ON DELETE CASCADE;
CREATE INDEX contract_handover_events_document_idx ON public.contract_handover_events(document_version_id);
CREATE OR REPLACE FUNCTION public.save_contract_document_version(contract_id_input uuid, document_id_input uuid, expected_version integer, snapshot_input jsonb)
RETURNS public.contract_generated_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contracts; latest integer; saved public.contract_generated_documents; field record;
BEGIN
  SELECT * INTO c FROM public.contracts WHERE id = contract_id_input FOR UPDATE;
  IF auth.uid() IS NULL OR c.id IS NULL OR NOT public.has_active_subscription() OR NOT public.can_project_module_action(c.project_id::text, 'module_contracts', true) THEN
    RAISE EXCEPTION 'K této smlouvě nemáte oprávnění zapisovat.' USING ERRCODE = '42501';
  END IF;
  IF document_id_input IS NULL OR expected_version IS NULL OR expected_version < 0 OR EXISTS (SELECT 1 FROM public.contract_generated_documents WHERE document_id = document_id_input AND contract_id <> c.id) THEN
    RAISE EXCEPTION 'Neplatná vazba dokumentu.';
  END IF;
  SELECT coalesce(max(version),0) INTO latest FROM public.contract_generated_documents WHERE document_id = document_id_input;
  IF latest <> expected_version THEN RAISE EXCEPTION 'Dokument má novější verzi. Obnovte seznam a otevřete ji.' USING ERRCODE = '40001'; END IF;
  IF EXISTS (SELECT 1 FROM public.contract_generated_documents WHERE document_id = document_id_input AND snapshot->>'kind' IS DISTINCT FROM snapshot_input->>'kind') THEN
    RAISE EXCEPTION 'Typ existujícího dokumentu nelze měnit.';
  END IF;
  IF snapshot_input IS NULL OR octet_length(snapshot_input::text) > 1500000
     OR (snapshot_input->>'schemaVersion') IS DISTINCT FROM '1' OR (snapshot_input->>'templateVersion') IS DISTINCT FROM '1'
     OR coalesce(snapshot_input->>'kind','') NOT IN ('sub_work_handover','sub_site_handover')
     OR jsonb_typeof(snapshot_input->'fields') IS DISTINCT FROM 'object'
     OR jsonb_typeof(snapshot_input#>'{fields,handwritingLines}') IS DISTINCT FROM 'number'
     OR coalesce(snapshot_input#>>'{fields,handwritingLines}', 'invalid') NOT IN ('0','5','10')
     OR coalesce(snapshot_input#>>'{fields,result}', 'invalid') NOT IN ('','accepted','with_defects','rejected')
     OR coalesce(snapshot_input#>>'{fields,scopeKind}', 'invalid') NOT IN ('whole','part') THEN RAISE EXCEPTION 'Neplatný obsah protokolu.'; END IF;
  FOR field IN SELECT key, value FROM jsonb_each(snapshot_input->'fields') LOOP
    IF field.key <> 'handwritingLines' AND (jsonb_typeof(field.value) <> 'string' OR length(field.value::text) > 12000) THEN RAISE EXCEPTION 'Pole protokolu je příliš dlouhé nebo neplatné.'; END IF;
  END LOOP;
  IF NOT (snapshot_input->'fields' ?& ARRAY['organizationName','organizationAddress','vendorName','vendorIco','vendorAddress','contractNumber','projectName','siteLocation','issuerRepresentative','vendorRepresentative','scope','actualDate','defects','defectsDeadline','attachments']) THEN RAISE EXCEPTION 'Chybí pole protokolu.'; END IF;
  PERFORM nullif(snapshot_input#>>'{fields,actualDate}','')::date, nullif(snapshot_input#>>'{fields,defectsDeadline}','')::date;
  PERFORM nullif(snapshot_input#>>'{fields,plannedDate}','')::date;
  IF coalesce(snapshot_input->'logo','null'::jsonb) <> 'null'::jsonb THEN
    IF jsonb_typeof(snapshot_input->'logo') <> 'object' OR coalesce(snapshot_input#>>'{logo,dataUrl}','') !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
       OR coalesce((snapshot_input#>>'{logo,width}')::integer,0) NOT BETWEEN 1 AND 640
       OR coalesce((snapshot_input#>>'{logo,height}')::integer,0) NOT BETWEEN 1 AND 640 THEN RAISE EXCEPTION 'Neplatné logo protokolu.'; END IF;
  END IF;
  INSERT INTO public.contract_generated_documents(contract_id, document_id, version, snapshot, created_by)
  VALUES (c.id, document_id_input, latest+1, snapshot_input || jsonb_build_object('createdAt',now(),'version',latest+1), auth.uid()) RETURNING * INTO saved;
  RETURN saved;
END; $$;


-- Both saving and confirming serialize on the same contract, preventing stale-version confirmations.
CREATE FUNCTION public.confirm_document_handover(version_id_input uuid, date_input date, result_input text, source_input text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.contract_generated_documents; c public.contracts;
BEGIN
  SELECT * INTO d FROM public.contract_generated_documents WHERE id = version_id_input;
  SELECT * INTO c FROM public.contracts WHERE id = d.contract_id FOR UPDATE;
  IF auth.uid() IS NULL OR c.id IS NULL OR NOT public.has_active_subscription() OR NOT public.can_project_module_action(c.project_id::text, 'module_contracts', true) THEN
    RAISE EXCEPTION 'K této smlouvě nemáte oprávnění zapisovat.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contract_generated_documents WHERE document_id = d.document_id AND version > d.version) THEN
    RAISE EXCEPTION 'Dokument má novější verzi. Obnovte seznam a otevřete ji.' USING ERRCODE = '40001';
  END IF;
  IF date_input IS NULL OR date_input > current_date OR date_input < DATE '1900-01-01'
    OR coalesce(result_input,'') NOT IN ('accepted','with_defects','rejected')
    OR source_input IS NULL OR length(trim(source_input)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Vyplňte skutečné datum, výsledek a zdroj potvrzení.';
  END IF;
  INSERT INTO public.contract_handover_events(contract_id,document_version_id,kind,effective_date,result,source_note,created_by)
  VALUES(c.id,d.id,CASE WHEN d.snapshot->>'kind' = 'sub_site_handover' THEN 'site_handover' ELSE 'handover' END,date_input,result_input,trim(source_input),auth.uid());
END; $$;
REVOKE ALL ON FUNCTION public.confirm_document_handover(uuid,date,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_document_handover(uuid,date,text,text) TO authenticated;
-- Existing RLS, private storage and warranty confirmation are deliberately unchanged.
