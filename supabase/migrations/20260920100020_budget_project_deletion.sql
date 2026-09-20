BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
ALTER TABLE private.construction_budget_purge_jobs ADD COLUMN deletes_project boolean NOT NULL DEFAULT false;

CREATE FUNCTION private.budget_project_delete_start(project_input text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job private.construction_budget_purge_jobs; org uuid;
BEGIN
 SELECT organization_id INTO org FROM public.projects WHERE id=project_input FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('completed',true,'paths','[]'::jsonb); END IF;
 IF NOT public.can_project_action(project_input,'delete') OR NOT public.has_project_subscription(project_input)
 THEN RAISE EXCEPTION 'Project deletion denied' USING ERRCODE='42501'; END IF;
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
 RETURN jsonb_build_object('id',job.id,'completed',false,'paths',COALESCE((SELECT jsonb_agg(storage_path) FROM public.construction_budget_sources WHERE purge_job_id=job.id),'[]'::jsonb));
END $$;
CREATE FUNCTION private.budget_project_delete_finish(project_input text,job_input uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.projects WHERE id=project_input FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF NOT public.can_project_action(project_input,'delete') OR NOT public.has_project_subscription(project_input)
 THEN RAISE EXCEPTION 'Project deletion denied' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.construction_budget_purge_jobs WHERE id=job_input AND project_id=project_input AND deletes_project)
 THEN RAISE EXCEPTION 'Invalid deletion job'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects o JOIN public.construction_budget_sources s ON s.storage_path=o.name WHERE s.project_id=project_input AND o.bucket_id='construction-budgets')
 THEN RAISE EXCEPTION 'Nejprve je nutné odstranit soubory rozpočtu. Opakujte mazání projektu.'; END IF;
 DELETE FROM public.construction_budget_history WHERE project_id=project_input;
 DELETE FROM public.construction_budget_revisions WHERE project_id=project_input;
 DELETE FROM public.construction_budget_sources WHERE project_id=project_input;
 DELETE FROM private.construction_budget_purge_jobs WHERE project_id=project_input;
 DELETE FROM public.projects WHERE id=project_input;
END $$;
-- Block new attachments after the first deletion transaction, including concurrent imports.
CREATE FUNCTION private.budget_project_delete_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.projects WHERE id=NEW.project_id FOR SHARE;
 IF EXISTS(SELECT 1 FROM private.construction_budget_purge_jobs WHERE project_id=NEW.project_id AND deletes_project AND completed_at IS NULL)
 THEN RAISE EXCEPTION 'Probíhá mazání projektu. Opakujte dokončení mazání.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER budget_source_project_delete_guard BEFORE INSERT ON public.construction_budget_sources FOR EACH ROW EXECUTE FUNCTION private.budget_project_delete_guard();
CREATE FUNCTION private.budget_project_file_delete_allowed(project_input text,job_input uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.can_project_action(project_input,'delete') AND public.has_project_subscription(project_input)
 AND EXISTS(SELECT 1 FROM private.construction_budget_purge_jobs WHERE id=job_input AND project_id=project_input AND deletes_project AND completed_at IS NULL)
$$;
CREATE POLICY construction_budget_project_files_delete ON storage.objects FOR DELETE TO authenticated USING(
 bucket_id='construction-budgets' AND EXISTS(SELECT 1 FROM public.construction_budget_sources s WHERE s.storage_path=name AND private.budget_project_file_delete_allowed(s.project_id,s.purge_job_id)));
CREATE FUNCTION public.construction_budget_project_delete_start(project_input text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_project_delete_start(project_input) $$;
CREATE FUNCTION public.construction_budget_project_delete_finish(project_input text,job_input uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_project_delete_finish(project_input,job_input) $$;
REVOKE ALL ON FUNCTION private.budget_project_delete_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.budget_project_delete_start(text),private.budget_project_delete_finish(text,uuid),private.budget_project_file_delete_allowed(text,uuid),public.construction_budget_project_delete_start(text),public.construction_budget_project_delete_finish(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.budget_project_delete_start(text),private.budget_project_delete_finish(text,uuid),private.budget_project_file_delete_allowed(text,uuid),public.construction_budget_project_delete_start(text),public.construction_budget_project_delete_finish(text,uuid) TO authenticated;
COMMIT;
