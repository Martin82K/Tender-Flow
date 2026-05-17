-- =====================================================
-- Tasks — personal TODO reminders
-- Migration: 20260517182000_task_reminders.sql
--
-- reminder_at is independent from due_at. A task can be due at one time
-- and notify the owner earlier or exactly at the due time.
-- =====================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_due_reminders
  ON public.tasks(reminder_at)
  WHERE reminder_at IS NOT NULL
    AND reminder_sent_at IS NULL
    AND completed = FALSE
    AND archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.tasks_reset_reminder_sent_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reminder_at IS DISTINCT FROM OLD.reminder_at THEN
    NEW.reminder_sent_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_tasks_reset_reminder_sent_at ON public.tasks;
CREATE TRIGGER tr_tasks_reset_reminder_sent_at
  BEFORE UPDATE OF reminder_at ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_reset_reminder_sent_at();

CREATE OR REPLACE FUNCTION public.process_due_task_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  WITH due_tasks AS (
    UPDATE public.tasks t
       SET reminder_sent_at = timezone('utc'::text, now()),
           updated_at = timezone('utc'::text, now())
     WHERE t.reminder_at IS NOT NULL
       AND t.reminder_sent_at IS NULL
       AND t.reminder_at <= timezone('utc'::text, now())
       AND t.completed = FALSE
       AND t.archived_at IS NULL
     RETURNING
       t.id,
       t.title,
       t.note,
       t.due_at,
       t.created_by
  ),
  inserted AS (
    INSERT INTO public.notifications (
      user_id,
      type,
      category,
      title,
      body,
      action_url,
      entity_type,
      entity_id
    )
    SELECT
      due_tasks.created_by,
      'warning',
      'deadline',
      'Připomenutí úkolu: ' || due_tasks.title,
      CASE
        WHEN due_tasks.due_at IS NOT NULL THEN 'Termín splnění: ' || to_char(due_tasks.due_at AT TIME ZONE 'Europe/Prague', 'DD.MM.YYYY HH24:MI')
        ELSE 'Úkol nemá nastavený termín splnění.'
      END,
      '/app/todo',
      'task_reminder',
      due_tasks.id::TEXT
    FROM due_tasks
    LEFT JOIN public.notification_preferences np
      ON np.user_id = due_tasks.created_by
    WHERE COALESCE(np.deadline_reminders, TRUE) = TRUE
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.process_due_task_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_due_task_reminders() TO service_role;

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
  WHERE jobname = 'process_due_task_reminders_5min'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'process_due_task_reminders_5min',
    '*/5 * * * *',
    'select public.process_due_task_reminders();'
  );
END $$;
