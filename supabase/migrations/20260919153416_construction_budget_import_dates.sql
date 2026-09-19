BEGIN;
ALTER TABLE public.construction_budget_sources ADD COLUMN first_converted_at timestamptz, ADD COLUMN last_converted_at timestamptz;
-- Derive historical dates only from persisted version creation events.
UPDATE public.construction_budget_sources s SET first_converted_at=v.first_at,last_converted_at=v.last_at
FROM (SELECT source_id,min(created_at) AS first_at,max(created_at) AS last_at FROM public.construction_budget_revisions WHERE document->>'origin' IS DISTINCT FROM 'copy' GROUP BY source_id) v
WHERE s.id=v.source_id AND s.purge_job_id IS NULL;
CREATE FUNCTION private.budget_record_conversion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.document->>'origin'='copy' THEN RETURN NEW; END IF;
 UPDATE public.construction_budget_sources SET first_converted_at=COALESCE(first_converted_at,NEW.created_at),last_converted_at=NEW.created_at WHERE id=NEW.source_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.budget_record_conversion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER budget_record_conversion AFTER INSERT ON public.construction_budget_revisions FOR EACH ROW EXECUTE FUNCTION private.budget_record_conversion();
COMMIT;
