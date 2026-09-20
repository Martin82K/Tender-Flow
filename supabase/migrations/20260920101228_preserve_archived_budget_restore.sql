BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
-- Archived projects deliberately deny editing. Their owner still has the explicit
-- restore capability; use it only for signed restoration of missing budget IDs.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('private.budget_backup_restore(jsonb,uuid,text)'::regprocedure) INTO definition;
 IF position('NOT private.budget_access(pid,''edit'')' IN definition)=0
   OR position('NOT private.budget_access(pid,''confirm'')' IN definition)=0
   OR position('NOT private.budget_access(pid,''allocate'')' IN definition)=0
 THEN RAISE EXCEPTION 'Unexpected budget restore definition'; END IF;
 definition:=replace(definition,'NOT private.budget_access(pid,''edit'')','NOT (private.budget_access(pid,''edit'') OR public.can_project_action(pid,''restore''))');
 definition:=replace(definition,'NOT private.budget_access(pid,''confirm'')','NOT (private.budget_access(pid,''confirm'') OR public.can_project_action(pid,''restore''))');
 definition:=replace(definition,'NOT private.budget_access(pid,''allocate'')','NOT (private.budget_access(pid,''allocate'') OR public.can_project_action(pid,''restore''))');
 EXECUTE definition;
END $migration$;
CREATE OR REPLACE FUNCTION private.budget_restore_file_allowed(source_input uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.construction_budget_restore_files f
 JOIN public.construction_budget_sources s ON s.id=f.source_id
 WHERE f.source_id=source_input AND f.actor_id=auth.uid() AND s.purge_job_id IS NULL
 AND (private.budget_access(s.project_id,'edit') OR public.can_project_action(s.project_id,'restore'))
 AND private.budget_access(s.project_id,'prices'))
$$;
COMMIT;
