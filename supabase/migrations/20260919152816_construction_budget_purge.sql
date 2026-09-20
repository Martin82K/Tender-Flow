BEGIN;
-- A durable job bridges Storage API deletion and the database transaction.
-- Failed jobs stay locked and can be resumed; no file metadata is deleted by SQL.
CREATE TABLE private.construction_budget_purge_jobs (
 id uuid PRIMARY KEY, project_id text NOT NULL REFERENCES public.projects(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz, revision_ids uuid[] NOT NULL, source_ids uuid[] NOT NULL
);
ALTER TABLE private.construction_budget_purge_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.construction_budget_purge_jobs FROM PUBLIC,anon,authenticated;
CREATE INDEX construction_budget_purge_project_idx ON private.construction_budget_purge_jobs(project_id);
CREATE INDEX construction_budget_purge_actor_idx ON private.construction_budget_purge_jobs(actor_id);
ALTER TABLE public.construction_budget_revisions ADD COLUMN purge_job_id uuid REFERENCES private.construction_budget_purge_jobs(id);
ALTER TABLE public.construction_budget_sources ADD COLUMN purge_job_id uuid REFERENCES private.construction_budget_purge_jobs(id);
CREATE INDEX construction_budget_revisions_purge_idx ON public.construction_budget_revisions(purge_job_id);
CREATE INDEX construction_budget_sources_purge_idx ON public.construction_budget_sources(purge_job_id);

CREATE FUNCTION private.budget_can_purge(project_input text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.budget_access(project_input,'edit') AND private.budget_access(project_input,'prices')
 AND EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_input AND public.is_active_org_admin_or_owner(p.organization_id))
$$;
REVOKE ALL ON FUNCTION private.budget_can_purge(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.budget_can_purge(text) TO authenticated;

CREATE FUNCTION private.budget_purge_lock() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.purge_job_id IS NOT NULL THEN RAISE EXCEPTION 'Probíhá trvalé mazání. Správce musí dokončit operaci v koši.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.budget_purge_lock() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER budget_source_purge_lock BEFORE UPDATE ON public.construction_budget_sources FOR EACH ROW EXECUTE FUNCTION private.budget_purge_lock();
CREATE TRIGGER budget_revision_purge_lock BEFORE UPDATE ON public.construction_budget_revisions FOR EACH ROW EXECUTE FUNCTION private.budget_purge_lock();

CREATE FUNCTION private.budget_purge_start(project_input text,job_input uuid,revisions_input jsonb,sources_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job private.construction_budget_purge_jobs; rids uuid[]; sids uuid[]; expected jsonb; rev public.construction_budget_revisions; src public.construction_budget_sources;
BEGIN
 IF NOT private.budget_can_purge(project_input) THEN RAISE EXCEPTION 'Purge requires organization administrator' USING ERRCODE='42501'; END IF;
 IF job_input IS NULL THEN RAISE EXCEPTION 'Missing operation ID'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(job_input::text,0));
 SELECT * INTO job FROM private.construction_budget_purge_jobs WHERE id=job_input;
 IF FOUND THEN
   IF job.project_id<>project_input THEN RAISE EXCEPTION 'Foreign operation' USING ERRCODE='42501'; END IF;
 ELSE
   IF jsonb_typeof(revisions_input) IS DISTINCT FROM 'array' OR jsonb_typeof(sources_input) IS DISTINCT FROM 'array'
      OR jsonb_array_length(revisions_input)+jsonb_array_length(sources_input) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Invalid purge selection'; END IF;
   SELECT COALESCE(array_agg((e->>'id')::uuid),'{}') INTO rids FROM jsonb_array_elements(revisions_input) e;
   SELECT COALESCE(array_agg((e->>'id')::uuid),'{}') INTO sids FROM jsonb_array_elements(sources_input) e;
   IF array_position(rids,NULL) IS NOT NULL OR array_position(sids,NULL) IS NOT NULL
      OR cardinality(rids)<>(SELECT count(DISTINCT x) FROM unnest(rids) x)
      OR cardinality(sids)<>(SELECT count(DISTINCT x) FROM unnest(sids) x) THEN RAISE EXCEPTION 'Invalid IDs'; END IF;
   -- Same source-before-revision lock order as save/trash. All target rows are
   -- checked after locking so a concurrent restore or revision edit is detected.
   PERFORM 1 FROM public.construction_budget_sources s WHERE s.project_id=project_input AND
     (s.id=ANY(sids) OR s.id IN (SELECT source_id FROM public.construction_budget_revisions WHERE id=ANY(rids) AND project_id=project_input)) ORDER BY s.id FOR UPDATE;
   PERFORM 1 FROM public.construction_budget_revisions WHERE project_id=project_input AND id=ANY(rids) ORDER BY id FOR UPDATE;
   FOR expected IN SELECT value FROM jsonb_array_elements(revisions_input) LOOP
     SELECT * INTO rev FROM public.construction_budget_revisions WHERE id=(expected->>'id')::uuid AND project_id=project_input;
     IF NOT FOUND OR rev.deleted_at IS NULL OR rev.purge_job_id IS NOT NULL OR rev.version IS DISTINCT FROM (expected->>'version')::integer THEN RAISE EXCEPTION 'Revize se změnila. Obnovte obsah koše.' USING ERRCODE='40001'; END IF;
   END LOOP;
   FOR expected IN SELECT value FROM jsonb_array_elements(sources_input) LOOP
     SELECT * INTO src FROM public.construction_budget_sources WHERE id=(expected->>'id')::uuid AND project_id=project_input;
     IF NOT FOUND OR src.deleted_at IS NULL OR src.purge_job_id IS NOT NULL OR src.deleted_at IS DISTINCT FROM (expected->>'deleted_at')::timestamptz THEN RAISE EXCEPTION 'Příloha se změnila. Obnovte obsah koše.' USING ERRCODE='40001'; END IF;
     IF EXISTS(SELECT 1 FROM public.construction_budget_revisions WHERE source_id=src.id AND NOT id=ANY(rids)) THEN RAISE EXCEPTION 'Přílohu používá jiná revize. Nejdříve smažte její revize nebo vysypte celý koš.'; END IF;
   END LOOP;
   INSERT INTO private.construction_budget_purge_jobs(id,project_id,actor_id,revision_ids,source_ids) VALUES(job_input,project_input,auth.uid(),rids,sids) RETURNING * INTO job;
   UPDATE public.construction_budget_sources SET purge_job_id=job.id WHERE id=ANY(sids);
   UPDATE public.construction_budget_revisions SET purge_job_id=job.id WHERE id=ANY(rids);
 END IF;
 RETURN jsonb_build_object('id',job.id,'completed',job.completed_at IS NOT NULL,'revisionCount',cardinality(job.revision_ids),'sourceCount',cardinality(job.source_ids),
   'paths',COALESCE((SELECT jsonb_agg(storage_path) FROM public.construction_budget_sources WHERE purge_job_id=job.id),'[]'::jsonb));
END $$;

CREATE FUNCTION private.budget_purge_finish(project_input text,job_input uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job private.construction_budget_purge_jobs;
BEGIN
 IF NOT private.budget_can_purge(project_input) THEN RAISE EXCEPTION 'Purge requires organization administrator' USING ERRCODE='42501'; END IF;
 SELECT * INTO job FROM private.construction_budget_purge_jobs WHERE id=job_input AND project_id=project_input FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Operation not found'; END IF;
 IF job.completed_at IS NOT NULL THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects o JOIN public.construction_budget_sources s ON o.bucket_id='construction-budgets' AND o.name=s.storage_path WHERE s.purge_job_id=job.id) THEN RAISE EXCEPTION 'Soubory ještě nejsou odstraněné. Opakujte dokončení mazání.'; END IF;
 DELETE FROM public.construction_budget_history WHERE revision_id=ANY(job.revision_ids);
 DELETE FROM public.construction_budget_revisions WHERE purge_job_id=job.id;
 DELETE FROM public.construction_budget_sources WHERE purge_job_id=job.id;
 UPDATE private.construction_budget_purge_jobs SET completed_at=now() WHERE id=job.id;
END $$;

CREATE FUNCTION public.construction_budget_purge_start(project_input text,job_input uuid,revisions_input jsonb,sources_input jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_purge_start(project_input,job_input,revisions_input,sources_input) $$;
CREATE FUNCTION public.construction_budget_purge_finish(project_input text,job_input uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_purge_finish(project_input,job_input) $$;
REVOKE ALL ON FUNCTION private.budget_purge_start(text,uuid,jsonb,jsonb),private.budget_purge_finish(text,uuid),public.construction_budget_purge_start(text,uuid,jsonb,jsonb),public.construction_budget_purge_finish(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.budget_purge_start(text,uuid,jsonb,jsonb),private.budget_purge_finish(text,uuid),public.construction_budget_purge_start(text,uuid,jsonb,jsonb),public.construction_budget_purge_finish(text,uuid) TO authenticated;

-- Budget objects use their project's subscription, like the budget RPCs.
-- Preserve both existing restrictive gates verbatim for every other bucket.
DO $policy$
DECLARE p record;
BEGIN
 FOR p IN SELECT policyname,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('subscription_required','tenant_subscription_required') LOOP
   EXECUTE format('ALTER POLICY %I ON storage.objects USING (CASE WHEN bucket_id=''construction-budgets'' THEN EXISTS(SELECT 1 FROM public.construction_budget_sources s WHERE s.storage_path=storage.objects.name AND public.has_project_subscription(s.project_id)) ELSE (%s) END) WITH CHECK (CASE WHEN bucket_id=''construction-budgets'' THEN EXISTS(SELECT 1 FROM public.construction_budget_sources s WHERE s.storage_path=storage.objects.name AND public.has_project_subscription(s.project_id)) ELSE (%s) END)',p.policyname,p.qual,p.with_check);
 END LOOP;
END $policy$;

CREATE POLICY construction_budget_files_purge ON storage.objects FOR DELETE TO authenticated USING(bucket_id='construction-budgets' AND EXISTS(SELECT 1 FROM public.construction_budget_sources s WHERE s.storage_path=name AND s.deleted_at IS NOT NULL AND s.purge_job_id IS NOT NULL AND private.budget_can_purge(s.project_id)));
ALTER POLICY construction_budget_files_insert ON storage.objects WITH CHECK(bucket_id='construction-budgets' AND EXISTS(SELECT 1 FROM public.construction_budget_sources s WHERE s.storage_path=name AND s.deleted_at IS NULL AND s.purge_job_id IS NULL AND private.budget_access(s.project_id,'edit') AND private.budget_access(s.project_id,'prices')));

CREATE OR REPLACE FUNCTION private.budget_load(project_input text, revision_input uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; prices boolean;
BEGIN
 IF NOT private.budget_access(project_input,'read') THEN RAISE EXCEPTION 'Budget access denied' USING ERRCODE='42501'; END IF;
 prices := private.budget_access(project_input,'prices');
 IF revision_input IS NULL THEN
   SELECT jsonb_build_object('permissions',jsonb_build_object('purge',private.budget_can_purge(project_input),'read',true,'prices',prices,'edit',private.budget_access(project_input,'edit'),'confirm',private.budget_access(project_input,'confirm'),'allocate',private.budget_access(project_input,'allocate')),
     'revisions',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'version',r.version,'source_id',r.source_id,'created_at',r.created_at,'deleted_at',r.deleted_at,'purge_job_id',r.purge_job_id,'allocation_count',jsonb_array_length(r.allocations),'category_ids',(SELECT COALESCE(jsonb_agg(DISTINCT a->>'categoryId'),'[]'::jsonb) FROM jsonb_array_elements(r.allocations) a)) ORDER BY r.created_at DESC) FROM public.construction_budget_revisions r WHERE r.project_id=project_input),'[]'::jsonb)) INTO result;
 ELSE
   SELECT to_jsonb(r) INTO result FROM public.construction_budget_revisions r WHERE r.id=revision_input AND r.project_id=project_input;
   IF result IS NULL THEN RAISE EXCEPTION 'Revision not found'; END IF;
   IF NOT prices THEN
     result := jsonb_set(result,'{document,nodes}',COALESCE((SELECT jsonb_agg(n||jsonb_build_object('unitPrice',NULL,'total',NULL,'source',jsonb_build_object('sheet',n#>>'{source,sheet}','row',n#>'{source,row}','cells','{}'::jsonb))) FROM jsonb_array_elements(result#>'{document,nodes}') n),'[]'::jsonb));
   END IF;
 END IF;
 IF revision_input IS NULL AND private.budget_can_purge(project_input) THEN
 result:=result||jsonb_build_object('purgeJobs',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',j.id,'revisionCount',cardinality(j.revision_ids),'sourceCount',cardinality(j.source_ids))) FROM private.construction_budget_purge_jobs j WHERE j.project_id=project_input AND j.completed_at IS NULL),'[]'::jsonb));
 END IF;
 RETURN result;
END $$;
COMMIT;
