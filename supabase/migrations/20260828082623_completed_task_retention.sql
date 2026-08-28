-- =====================================================
-- Tasks — completed item retention and manual cleanup
--
-- Completed tasks remain visible for at most 14 days. Users may remove
-- their own completed tasks sooner; active tasks and active subtasks are
-- never removed by either cleanup path.
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tasks_completed_retention
  ON public.tasks(completed_at)
  WHERE completed = TRUE AND completed_at IS NOT NULL;

ALTER TABLE public.microsoft_todo_list_mappings
  ADD COLUMN IF NOT EXISTS sync_policy_version SMALLINT NOT NULL DEFAULT 1
  CHECK (sync_policy_version BETWEEN 1 AND 32767);

COMMENT ON COLUMN public.microsoft_todo_list_mappings.sync_policy_version IS
  'Forces one full Graph delta refresh when Microsoft To Do synchronization policy changes.';

CREATE OR REPLACE FUNCTION public.purge_completed_tasks(retention_days INTEGER DEFAULT 14)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_days INTEGER := GREATEST(COALESCE(retention_days, 14), 1);
  v_deleted INTEGER := 0;
  v_cutoff TIMESTAMPTZ := timezone('utc'::text, now()) - make_interval(days => v_days);
BEGIN
  DELETE FROM public.tasks AS task
   WHERE task.completed = TRUE
     AND task.completed_at IS NOT NULL
     AND task.completed_at < v_cutoff
     AND (
       task.parent_task_id IS NOT NULL
       OR NOT EXISTS (
         SELECT 1
           FROM public.tasks AS child
          WHERE child.parent_task_id = task.id
            AND (
              child.completed = FALSE
              OR child.completed_at IS NULL
              OR child.completed_at >= v_cutoff
            )
       )
     );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_completed_tasks(INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_completed_tasks(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_my_completed_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.tasks AS task
   WHERE task.created_by = (SELECT auth.uid())
     AND task.completed = TRUE
     AND (
       task.parent_task_id IS NOT NULL
       OR NOT EXISTS (
         SELECT 1
           FROM public.tasks AS child
          WHERE child.parent_task_id = task.id
            AND child.completed = FALSE
       )
     );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_completed_tasks()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_my_completed_tasks() TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RETURN;
  END IF;

  FOR existing_job_id IN
    SELECT jobid
      FROM cron.job
     WHERE jobname IN (
       'archive_completed_tasks_5d_daily',
       'archive_completed_tasks_30d_daily',
       'delete_archived_tasks_30d_daily',
       'purge_completed_tasks_14d_daily'
     )
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'purge_completed_tasks_14d_daily',
    '39 3 * * *',
    'select public.purge_completed_tasks(14);'
  );
END $$;

COMMENT ON FUNCTION public.purge_completed_tasks(INTEGER) IS
  'Service-only cleanup of completed personal tasks after the configured retention window.';
COMMENT ON FUNCTION public.delete_my_completed_tasks() IS
  'RLS-scoped manual deletion of the authenticated user completed tasks.';
