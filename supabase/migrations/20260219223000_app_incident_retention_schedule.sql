-- Schedule daily retention cleanup for incident logs.
-- Keeps last 60 days in public.app_incident_events.

create extension if not exists pg_cron;

do $$
declare
  existing_job_id bigint;
begin
  if to_regnamespace('cron') is null then
    return;
  end if;

  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'purge_app_incident_events_60d'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'purge_app_incident_events_60d',
    '17 3 * * *',
    'select public.purge_old_app_incident_events(60);'
  );
end $$;
