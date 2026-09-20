BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION private.budget_assert_unlocked(project_input text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.projects WHERE id=project_input FOR UPDATE;
 IF EXISTS(SELECT 1 FROM private.budget_edit_locks WHERE project_id=project_input AND locked)
 THEN RAISE EXCEPTION 'Rozpočet je uzamčen. Před změnou jej odemkněte.' USING ERRCODE='55000'; END IF;
END $$;

CREATE OR REPLACE FUNCTION private.budget_project_delete_start(project_input text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job private.construction_budget_purge_jobs; org uuid; was_locked boolean;
BEGIN
 SELECT organization_id INTO org FROM public.projects WHERE id=project_input FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('completed',true,'paths','[]'::jsonb); END IF;
 IF public.can_project_action(project_input,'delete') IS NOT TRUE OR public.has_project_subscription(project_input) IS NOT TRUE
 THEN RAISE EXCEPTION 'Project deletion denied' USING ERRCODE='42501'; END IF;
 -- Only this authorized transaction may suspend the edit lock; restore it before returning.
 SELECT locked INTO was_locked FROM private.budget_edit_locks WHERE project_id=project_input;
 UPDATE private.budget_edit_locks SET locked=false WHERE project_id=project_input AND locked;
 SELECT * INTO job FROM private.construction_budget_purge_jobs WHERE project_id=project_input AND deletes_project AND completed_at IS NULL;
 IF NOT FOUND THEN
   IF EXISTS(SELECT 1 FROM private.construction_budget_purge_jobs WHERE project_id=project_input AND completed_at IS NULL)
   THEN RAISE EXCEPTION 'Nejprve dokončete rozpracované mazání v koši rozpočtu.'; END IF;
   PERFORM 1 FROM public.construction_budget_sources WHERE project_id=project_input ORDER BY id FOR UPDATE;
   PERFORM 1 FROM public.construction_budget_revisions WHERE project_id=project_input ORDER BY id FOR UPDATE;
   INSERT INTO private.construction_budget_purge_jobs(id,project_id,actor_id,revision_ids,source_ids,deletes_project)
   SELECT gen_random_uuid(),project_input,auth.uid(),
     ARRAY(SELECT id FROM public.construction_budget_revisions WHERE project_id=project_input),
     ARRAY(SELECT id FROM public.construction_budget_sources WHERE project_id=project_input),true RETURNING * INTO job;
   UPDATE public.construction_budget_sources SET deleted_at=COALESCE(deleted_at,now()),purge_job_id=job.id WHERE project_id=project_input;
   UPDATE public.construction_budget_revisions SET deleted_at=COALESCE(deleted_at,now()),purge_job_id=job.id WHERE project_id=project_input;
 END IF;
 UPDATE private.budget_edit_locks SET locked=was_locked WHERE project_id=project_input;
 RETURN jsonb_build_object('id',job.id,'completed',false,'paths',COALESCE((SELECT jsonb_agg(storage_path) FROM public.construction_budget_sources WHERE purge_job_id=job.id),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION private.budget_project_delete_finish(project_input text,job_input uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.projects WHERE id=project_input FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF public.can_project_action(project_input,'delete') IS NOT TRUE OR public.has_project_subscription(project_input) IS NOT TRUE
 THEN RAISE EXCEPTION 'Project deletion denied' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.construction_budget_purge_jobs WHERE id=job_input AND project_id=project_input AND deletes_project)
 THEN RAISE EXCEPTION 'Invalid deletion job'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects o JOIN public.construction_budget_sources s ON s.storage_path=o.name WHERE s.project_id=project_input AND o.bucket_id='construction-budgets')
 THEN RAISE EXCEPTION 'Nejprve je nutné odstranit soubory rozpočtu. Opakujte mazání projektu.'; END IF;
 -- Validation above must succeed first. Errors roll back this transaction-local unlock.
 UPDATE private.budget_edit_locks SET locked=false WHERE project_id=project_input AND locked;
 DELETE FROM public.construction_budget_history WHERE project_id=project_input;
 DELETE FROM public.construction_budget_revisions WHERE project_id=project_input;
 DELETE FROM public.construction_budget_sources WHERE project_id=project_input;
 DELETE FROM private.construction_budget_purge_jobs WHERE project_id=project_input;
 DELETE FROM public.projects WHERE id=project_input;
END $$;

CREATE OR REPLACE FUNCTION private.validate_tender_definitions(definitions jsonb,limit_input integer) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE entry jsonb;
BEGIN
 IF definitions IS NULL OR jsonb_typeof(definitions)<>'array' OR limit_input IS NULL OR limit_input<1 OR jsonb_array_length(definitions)>limit_input THEN RAISE EXCEPTION 'Číselník smí mít nejvýše % VŘ.',limit_input; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(definitions) LOOP
   IF jsonb_typeof(entry)<>'object' OR jsonb_typeof(entry->'id') IS DISTINCT FROM 'string'
    OR length(entry->>'id') NOT BETWEEN 1 AND 100 OR jsonb_typeof(entry->'title') IS DISTINCT FROM 'string'
    OR length(btrim(entry->>'title'))>255
    OR length(btrim(regexp_replace(entry->>'title','\s+',' ','g'))) NOT BETWEEN 1 AND 255 OR jsonb_typeof(entry->'externalCode') IS DISTINCT FROM 'string'
    OR length(entry->>'externalCode')>100 THEN RAISE EXCEPTION 'Vyplňte platné číslo a název VŘ.'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e GROUP BY lower(btrim(regexp_replace(e->>'title','\s+',' ','g'))) HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e WHERE btrim(e->>'externalCode')<>'' GROUP BY btrim(e->>'externalCode') HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e GROUP BY e->>'id' HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Duplicitní název nebo číslo VŘ.'; END IF;
END $$;

COMMIT;
