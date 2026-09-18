-- Logical deletion keeps immutable snapshots, attachments and handover evidence for audit.
ALTER TABLE public.contract_generated_documents
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX contract_generated_documents_deleted_by_idx ON public.contract_generated_documents(deleted_by);

CREATE FUNCTION public.delete_contract_document(contract_id_input uuid, document_id_input uuid, expected_version integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contracts; latest integer;
BEGIN
  SELECT * INTO c FROM public.contracts WHERE id = contract_id_input FOR UPDATE;
  IF auth.uid() IS NULL OR c.id IS NULL OR public.has_active_subscription() IS NOT TRUE
    OR public.can_project_module_action(c.project_id::text, 'module_contracts', true) IS NOT TRUE
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = c.project_id::text AND status = 'archived') THEN
    RAISE EXCEPTION 'K této smlouvě nemáte oprávnění zapisovat.' USING ERRCODE = '42501';
  END IF;
  SELECT max(version) INTO latest FROM public.contract_generated_documents
    WHERE contract_id = c.id AND document_id = document_id_input AND deleted_at IS NULL;
  IF latest IS NULL THEN RAISE EXCEPTION 'Dokument není dostupný nebo již byl smazán.'; END IF;
  IF expected_version IS NULL OR latest <> expected_version THEN
    RAISE EXCEPTION 'Dokument má novější verzi. Obnovte seznam a otevřete ji.' USING ERRCODE = '40001';
  END IF;
  UPDATE public.contract_generated_documents SET deleted_at = clock_timestamp(), deleted_by = auth.uid()
    WHERE contract_id = c.id AND document_id = document_id_input AND deleted_at IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.delete_contract_document(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_contract_document(uuid,uuid,integer) TO authenticated;

-- Serialize all document writes with deletion, including stale clients and file attachments.
CREATE FUNCTION public.guard_active_contract_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cid uuid; docid uuid; vid uuid;
BEGIN
  IF TG_TABLE_NAME = 'contract_generated_documents' THEN
    cid := NEW.contract_id; docid := NEW.document_id;
  ELSE
    IF TG_TABLE_NAME = 'contract_document_files' THEN vid := NEW.version_id;
    ELSE vid := NEW.document_version_id; END IF;
    IF vid IS NULL THEN RETURN NEW; END IF;
    SELECT contract_id, document_id INTO cid, docid FROM public.contract_generated_documents WHERE id = vid;
  END IF;
  PERFORM 1 FROM public.contracts WHERE id = cid FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.contract_generated_documents WHERE document_id = docid AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Dokument byl smazán. Obnovte seznam protokolů.' USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_active_contract_document() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_active_document_version BEFORE INSERT ON public.contract_generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_active_contract_document();
CREATE TRIGGER guard_active_document_file BEFORE INSERT ON public.contract_document_files
  FOR EACH ROW EXECUTE FUNCTION public.guard_active_contract_document();
CREATE TRIGGER guard_active_document_handover BEFORE INSERT ON public.contract_handover_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_active_contract_document();
