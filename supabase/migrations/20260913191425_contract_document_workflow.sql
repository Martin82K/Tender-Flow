-- Immutable generated-document versions and audited business events. No legacy-date backfill.
CREATE TABLE public.contract_generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  document_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object' AND octet_length(snapshot::text) <= 1500000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(document_id, version)
);
CREATE INDEX contract_generated_documents_contract_idx ON public.contract_generated_documents(contract_id, created_at DESC);
CREATE TABLE public.contract_document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.contract_generated_documents(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX contract_document_files_version_idx ON public.contract_document_files(version_id);
CREATE TABLE public.contract_handover_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('handover', 'warranty')),
  effective_date date NOT NULL,
  result text NOT NULL CHECK (result IN ('', 'accepted', 'with_defects', 'rejected')),
  source_note text NOT NULL CHECK (length(trim(source_note)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX contract_handover_events_contract_idx ON public.contract_handover_events(contract_id, created_at DESC);
CREATE INDEX contract_generated_documents_author_idx ON public.contract_generated_documents(created_by);
CREATE INDEX contract_document_files_author_idx ON public.contract_document_files(created_by);
CREATE INDEX contract_handover_events_author_idx ON public.contract_handover_events(created_by);
ALTER TABLE public.contracts ADD COLUMN warranty_start_at date;
COMMENT ON COLUMN public.contracts.warranty_start_at IS 'Explicit audited warranty confirmation only; never inferred from completion_date or document export.';

ALTER TABLE public.contract_generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_document_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_handover_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_generated_documents, public.contract_document_files, public.contract_handover_events FROM anon, authenticated;
GRANT SELECT ON public.contract_generated_documents, public.contract_document_files, public.contract_handover_events TO authenticated;
GRANT ALL ON public.contract_generated_documents, public.contract_document_files, public.contract_handover_events TO service_role;
CREATE POLICY document_versions_read ON public.contract_generated_documents FOR SELECT TO authenticated
USING (public.has_active_subscription() AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND public.can_project_module_action(c.project_id::text, 'module_contracts', false)));
CREATE POLICY document_files_read ON public.contract_document_files FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.contract_generated_documents d WHERE d.id = version_id));
CREATE POLICY handover_events_read ON public.contract_handover_events FOR SELECT TO authenticated
USING (public.has_active_subscription() AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND public.can_project_module_action(c.project_id::text, 'module_contracts', false)));

CREATE FUNCTION public.save_contract_document_version(contract_id_input uuid, document_id_input uuid, expected_version integer, snapshot_input jsonb)
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
  IF snapshot_input IS NULL OR octet_length(snapshot_input::text) > 1500000
     OR (snapshot_input->>'schemaVersion') IS DISTINCT FROM '1' OR (snapshot_input->>'templateVersion') IS DISTINCT FROM '1'
     OR (snapshot_input->>'kind') IS DISTINCT FROM 'sub_work_handover'
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
  IF coalesce(snapshot_input->'logo','null'::jsonb) <> 'null'::jsonb THEN
    IF jsonb_typeof(snapshot_input->'logo') <> 'object' OR coalesce(snapshot_input#>>'{logo,dataUrl}','') !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
       OR coalesce((snapshot_input#>>'{logo,width}')::integer,0) NOT BETWEEN 1 AND 640
       OR coalesce((snapshot_input#>>'{logo,height}')::integer,0) NOT BETWEEN 1 AND 640 THEN RAISE EXCEPTION 'Neplatné logo protokolu.'; END IF;
  END IF;
  INSERT INTO public.contract_generated_documents(contract_id, document_id, version, snapshot, created_by)
  VALUES (c.id, document_id_input, latest+1, snapshot_input || jsonb_build_object('createdAt',now(),'version',latest+1), auth.uid()) RETURNING * INTO saved;
  RETURN saved;
END; $$;

-- Confirmation is explicit, append-only and serialized per contract. No file function calls it.
CREATE FUNCTION public.confirm_contract_handover_event(contract_id_input uuid, kind_input text, date_input date, result_input text, source_input text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contracts;
BEGIN
  SELECT * INTO c FROM public.contracts WHERE id = contract_id_input FOR UPDATE;
  IF auth.uid() IS NULL OR c.id IS NULL OR NOT public.has_active_subscription() OR NOT public.can_project_module_action(c.project_id::text, 'module_contracts', true) THEN
    RAISE EXCEPTION 'K této smlouvě nemáte oprávnění zapisovat.' USING ERRCODE = '42501';
  END IF;
  IF date_input IS NULL OR date_input > current_date OR date_input < DATE '1900-01-01' OR kind_input IS NULL OR kind_input NOT IN ('handover','warranty')
     OR source_input IS NULL OR length(trim(source_input)) NOT BETWEEN 1 AND 2000
     OR (kind_input = 'handover' AND coalesce(result_input,'') NOT IN ('accepted','with_defects','rejected')) THEN RAISE EXCEPTION 'Vyplňte skutečné datum, výsledek a zdroj potvrzení.'; END IF;
  INSERT INTO public.contract_handover_events(contract_id,kind,effective_date,result,source_note,created_by)
  VALUES(c.id,kind_input,date_input,CASE WHEN kind_input='warranty' THEN '' ELSE result_input END,trim(source_input),auth.uid());
  IF kind_input = 'warranty' THEN UPDATE public.contracts SET warranty_start_at = date_input WHERE id = c.id; END IF;
END; $$;

-- Direct contract edits/OCR cannot manufacture a confirmed warranty start.
CREATE FUNCTION public.guard_confirmed_contract_warranty() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE confirmed date;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.warranty_start_at IS NOT NULL) OR (TG_OP = 'UPDATE' AND NEW.warranty_start_at IS DISTINCT FROM OLD.warranty_start_at) THEN
    SELECT effective_date INTO confirmed FROM public.contract_handover_events WHERE contract_id = NEW.id AND kind = 'warranty' ORDER BY created_at DESC, id DESC LIMIT 1;
    IF confirmed IS NULL OR NEW.warranty_start_at IS DISTINCT FROM confirmed THEN RAISE EXCEPTION 'Začátek záruky vyžaduje samostatné potvrzení.'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_confirmed_contract_warranty BEFORE INSERT OR UPDATE OF warranty_start_at ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.guard_confirmed_contract_warranty();

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('contract-protocol-files','contract-protocol-files',false,20971520,ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
CREATE POLICY protocol_files_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'contract-protocol-files' AND EXISTS (SELECT 1 FROM public.contract_generated_documents d WHERE d.contract_id::text = split_part(name,'/',1) AND d.id::text = split_part(name,'/',2))
);
CREATE POLICY protocol_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'contract-protocol-files' AND public.has_active_subscription()
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|docx)$'
  AND EXISTS (SELECT 1 FROM public.contract_generated_documents d JOIN public.contracts c ON c.id = d.contract_id
    WHERE d.contract_id::text = split_part(name,'/',1) AND d.id::text = split_part(name,'/',2) AND public.can_project_module_action(c.project_id::text,'module_contracts',true))
);
CREATE POLICY protocol_files_remove_orphan ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'contract-protocol-files' AND owner_id = auth.uid()::text
  AND NOT EXISTS (SELECT 1 FROM public.contract_document_files f WHERE f.storage_path = name)
  AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id::text = split_part(name,'/',1) AND public.can_project_module_action(c.project_id::text,'module_contracts',true))
);
CREATE FUNCTION public.attach_contract_document_file(version_id_input uuid,path_input text,name_input text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.contract_generated_documents; c public.contracts;
BEGIN
  SELECT * INTO d FROM public.contract_generated_documents WHERE id = version_id_input;
  SELECT * INTO c FROM public.contracts WHERE id = d.contract_id;
  IF auth.uid() IS NULL OR c.id IS NULL OR NOT public.has_active_subscription() OR NOT public.can_project_module_action(c.project_id::text,'module_contracts',true) THEN RAISE EXCEPTION 'Chybí oprávnění ke smlouvě.' USING ERRCODE = '42501'; END IF;
  IF split_part(path_input,'/',1) IS DISTINCT FROM c.id::text OR split_part(path_input,'/',2) IS DISTINCT FROM d.id::text
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='contract-protocol-files' AND name=path_input AND owner_id=auth.uid()::text)
    OR name_input IS NULL OR length(name_input) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'Neplatný soubor dokumentu.'; END IF;
  INSERT INTO public.contract_document_files(version_id,storage_path,file_name,created_by) VALUES(d.id,path_input,name_input,auth.uid());
END; $$;
REVOKE ALL ON FUNCTION public.save_contract_document_version(uuid,uuid,integer,jsonb), public.confirm_contract_handover_event(uuid,text,date,text,text), public.attach_contract_document_file(uuid,text,text), public.guard_confirmed_contract_warranty() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_contract_document_version(uuid,uuid,integer,jsonb), public.confirm_contract_handover_event(uuid,text,date,text,text), public.attach_contract_document_file(uuid,text,text) TO authenticated;
