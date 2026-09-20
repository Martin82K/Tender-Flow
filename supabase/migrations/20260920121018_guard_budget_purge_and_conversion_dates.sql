BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
-- Project deletion must finish through its own authorization and cleanup flow.
DO $migration$
DECLARE signature text; definition text; anchor text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['private.budget_purge_start(text,uuid,jsonb,jsonb)','private.budget_purge_finish(text,uuid)'] LOOP
   SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
   anchor:=CASE WHEN signature LIKE '%_start(%' THEN 'IF job.project_id<>project_input' ELSE 'IF job.completed_at IS NOT NULL THEN RETURN; END IF;' END;
   IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Unexpected purge function'; END IF;
   definition:=replace(definition,anchor,'IF job.deletes_project THEN RAISE EXCEPTION ''Tuto operaci dokončete opakováním mazání projektu.''; END IF; '||anchor);
   EXECUTE definition;
 END LOOP;
 SELECT pg_get_functiondef('private.budget_load(text,uuid)'::regprocedure) INTO definition;
 anchor:='FROM private.construction_budget_purge_jobs j WHERE j.project_id=project_input AND j.completed_at IS NULL';
 IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Unexpected trash job listing'; END IF;
 EXECUTE replace(definition,anchor,anchor||' AND NOT j.deletes_project');
END $migration$;
-- Inserts during signed backup restore arrive in UUID order, not date order.
-- Keep retained source metadata (including purged imports), expanding its range.
CREATE OR REPLACE FUNCTION private.budget_record_conversion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.document->>'origin'='copy' THEN RETURN NEW; END IF;
 UPDATE public.construction_budget_sources
 SET first_converted_at=LEAST(first_converted_at,NEW.created_at),
     last_converted_at=GREATEST(last_converted_at,NEW.created_at)
 WHERE id=NEW.source_id;
 RETURN NEW;
END $$;
UPDATE public.construction_budget_sources s
SET first_converted_at=LEAST(s.first_converted_at,v.first_at),
    last_converted_at=GREATEST(s.last_converted_at,v.last_at)
FROM (SELECT source_id,min(created_at) first_at,max(created_at) last_at
 FROM public.construction_budget_revisions WHERE document->>'origin' IS DISTINCT FROM 'copy' GROUP BY source_id) v
WHERE s.id=v.source_id AND s.purge_job_id IS NULL
 AND (s.first_converted_at IS DISTINCT FROM LEAST(s.first_converted_at,v.first_at)
      OR s.last_converted_at IS DISTINCT FROM GREATEST(s.last_converted_at,v.last_at));
COMMIT;
