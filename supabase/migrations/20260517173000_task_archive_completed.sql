-- =====================================================
-- Tasks — automatic archive for completed personal TODO items
-- Migration: 20260517173000_task_archive_completed.sql
--
-- Completed tasks stay recoverable. After 30 days they leave active TODO,
-- Command Center and calendar surfaces by setting archived_at.
-- =====================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_active_personal
  ON tasks(created_by, completed, due_at)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_archived_personal
  ON tasks(created_by, archived_at DESC)
  WHERE archived_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.archive_completed_tasks(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INTEGER := GREATEST(COALESCE(retention_days, 30), 0);
  v_archived INTEGER := 0;
BEGIN
  UPDATE public.tasks
     SET archived_at = timezone('utc'::text, now()),
         updated_at = timezone('utc'::text, now())
   WHERE completed = TRUE
     AND completed_at IS NOT NULL
     AND archived_at IS NULL
     AND completed_at < timezone('utc'::text, now()) - make_interval(days => v_days);

  GET DIAGNOSTICS v_archived = ROW_COUNT;
  RETURN v_archived;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_completed_tasks(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_completed_tasks(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_archived_tasks(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INTEGER := GREATEST(COALESCE(retention_days, 30), 1);
  v_deleted INTEGER := 0;
BEGIN
  DELETE FROM public.tasks
   WHERE archived_at IS NOT NULL
     AND archived_at < timezone('utc'::text, now()) - make_interval(days => v_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_archived_tasks(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_archived_tasks(INTEGER) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RETURN;
  END IF;

  SELECT jobid
    INTO existing_job_id
  FROM cron.job
  WHERE jobname IN ('archive_completed_tasks_5d_daily', 'archive_completed_tasks_30d_daily')
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'archive_completed_tasks_30d_daily',
    '29 3 * * *',
    'select public.archive_completed_tasks(30);'
  );

  SELECT jobid
    INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'delete_archived_tasks_30d_daily'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'delete_archived_tasks_30d_daily',
    '39 3 * * *',
    'select public.delete_archived_tasks(30);'
  );
END $$;
