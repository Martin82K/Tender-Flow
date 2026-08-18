-- Enforce the 365-day retention policy automatically without exposing the
-- destructive purge RPC to ordinary authenticated users.

CREATE OR REPLACE FUNCTION public.purge_app_usage_stats_admin()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  retention_days INTEGER := 365;
  deleted_count BIGINT := 0;
BEGIN
  SELECT crp.retention_days
  INTO retention_days
  FROM public.compliance_retention_policies crp
  WHERE crp.id = 'app-usage-daily-stats';

  DELETE FROM public.usage_daily_stats uds
  WHERE uds.stat_date < CURRENT_DATE - (GREATEST(COALESCE(retention_days, 365), 1) - 1);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  DELETE FROM public.usage_session_state uss
  WHERE uss.expires_at < timezone('utc'::TEXT, now());

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_app_usage_stats_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_app_usage_stats_admin() TO service_role;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT j.jobid
  INTO existing_job_id
  FROM cron.job j
  WHERE j.jobname = 'purge-app-usage-stats'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'purge-app-usage-stats',
    '47 3 * * *',
    'SELECT public.purge_app_usage_stats_admin();'
  );
END;
$$;
