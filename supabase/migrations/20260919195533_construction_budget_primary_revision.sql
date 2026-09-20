BEGIN;
-- A shared project preference, never a browser-only setting. No direct client writes.
CREATE TABLE private.construction_budget_preferences (
 project_id text PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
 revision_id uuid REFERENCES public.construction_budget_revisions(id) ON DELETE SET NULL
);
CREATE INDEX construction_budget_preferences_revision_idx ON private.construction_budget_preferences(revision_id);
ALTER TABLE private.construction_budget_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.construction_budget_preferences FROM PUBLIC,anon,authenticated;
-- Preserve the version existing users opened before this migration.
INSERT INTO private.construction_budget_preferences(project_id,revision_id)
 SELECT DISTINCT ON(project_id) project_id,id FROM public.construction_budget_revisions
 WHERE deleted_at IS NULL AND purge_job_id IS NULL ORDER BY project_id,created_at DESC,id;

CREATE FUNCTION private.budget_set_primary(project_input text,revision_input uuid,expected_input uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous uuid; target public.construction_budget_revisions;
BEGIN
 IF NOT private.budget_access(project_input,'edit') OR NOT private.budget_access(project_input,'prices') THEN
  RAISE EXCEPTION 'Budget edit denied' USING ERRCODE='42501';
 END IF;
 -- Same revision-before-preference order as the trash trigger. No other revision is locked.
 SELECT * INTO target FROM public.construction_budget_revisions WHERE id=revision_input AND project_id=project_input FOR UPDATE;
 IF NOT FOUND OR target.deleted_at IS NOT NULL OR target.purge_job_id IS NOT NULL THEN RAISE EXCEPTION 'Verze není dostupná.'; END IF;
 INSERT INTO private.construction_budget_preferences(project_id) VALUES(project_input) ON CONFLICT DO NOTHING;
 SELECT revision_id INTO previous FROM private.construction_budget_preferences WHERE project_id=project_input FOR UPDATE;
 IF previous IS DISTINCT FROM expected_input THEN RAISE EXCEPTION 'Hlavní verzi mezitím změnil jiný uživatel. Obnovte rozpočet.' USING ERRCODE='40001'; END IF;
 IF previous IS NOT DISTINCT FROM revision_input THEN RETURN; END IF;
 UPDATE private.construction_budget_preferences SET revision_id=revision_input WHERE project_id=project_input;
 INSERT INTO public.construction_budget_history(revision_id,project_id,actor_id,event,previous_version,new_version)
 VALUES(revision_input,project_input,auth.uid(),'set_primary',target.version,target.version);
END $$;
CREATE FUNCTION public.construction_budget_set_primary(project_input text,revision_input uuid,expected_input uuid DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_set_primary(project_input,revision_input,expected_input) $$;
REVOKE ALL ON FUNCTION private.budget_set_primary(text,uuid,uuid),public.construction_budget_set_primary(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.budget_set_primary(text,uuid,uuid),public.construction_budget_set_primary(text,uuid,uuid) TO authenticated;

CREATE FUNCTION private.budget_primary_on_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE primary_id uuid; replacement_id uuid;
BEGIN
 INSERT INTO private.construction_budget_preferences(project_id) VALUES(NEW.project_id) ON CONFLICT DO NOTHING;
 SELECT revision_id INTO primary_id FROM private.construction_budget_preferences WHERE project_id=NEW.project_id FOR UPDATE;
 IF primary_id=NEW.id AND NEW.deleted_at IS NOT NULL THEN
  -- Read candidates only after acquiring the preference lock. A concurrent trash
  -- operation rechecks this pointer in its own trigger after the lock is released.
  SELECT id INTO replacement_id FROM public.construction_budget_revisions
   WHERE project_id=NEW.project_id AND id<>NEW.id AND deleted_at IS NULL AND purge_job_id IS NULL
   ORDER BY created_at,id LIMIT 1;
  UPDATE private.construction_budget_preferences SET revision_id=replacement_id WHERE project_id=NEW.project_id;
 ELSIF primary_id IS NULL AND NEW.deleted_at IS NULL AND NEW.purge_job_id IS NULL THEN
  UPDATE private.construction_budget_preferences SET revision_id=NEW.id WHERE project_id=NEW.project_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.budget_primary_on_revision() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER budget_primary_on_revision AFTER INSERT OR UPDATE OF deleted_at ON public.construction_budget_revisions
 FOR EACH ROW EXECUTE FUNCTION private.budget_primary_on_revision();

-- Keep price redaction, purge information and existing permission checks unchanged.
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
 IF revision_input IS NULL THEN
  result:=result||jsonb_build_object('mainRevisionId',(SELECT revision_id FROM private.construction_budget_preferences WHERE project_id=project_input));
 END IF;
 RETURN result;
END $$;
COMMIT;
